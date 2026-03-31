<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

import { useUpload } from '~/composables/useUpload'

const route = useRoute()
const { uploadFile } = useUpload()

// Pre-fill from query params (from calendar click)
const selectedYear = ref(route.query.year ? Number(route.query.year) : new Date().getFullYear())
const selectedSeason = ref((route.query.season as string) || '')
const selectedRegion = ref((route.query.region as string) || 'US')

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 30 }, (_, i) => currentYear - i)
const seasons = [
  'Spring', 'Summer', 'Autumn', 'Winter',
  "Valentine's Day", "Mother's Day", "Father's Day",
  'Easter', 'Halloween', 'Christmas', 'Holiday',
  'Pre-Spring', 'Pre-Autumn', 'Year-Round', 'Special Edition'
]
const regions = ['US', 'UK', 'EU', 'AU', 'Asia', 'Other']

// Upload mode
const mode = ref<'select' | 'images' | 'preview'>('select')

// For PDF uploads
const pdfFile = ref<File | null>(null)
const pdfPreviewUrl = ref('')
const pdfPageCount = ref(0)
const pdfHasText = ref(false)
const pdfNeedsOcr = ref(false)
const pdfOcrProcessing = ref(false)
const pdfOcrProgress = ref(0)
const processedPdfBlob = ref<Blob | null>(null)
const processedPdfUrl = ref('')

// For image uploads
interface ImageUpload {
  id: string
  file: File
  preview: string
  pageNumber: number
  ocrText?: string
  ocrProcessing?: boolean
}
const images = ref<ImageUpload[]>([])

// OCR processing
const ocrProcessing = ref(false)
const ocrProgress = ref(0)

// PDF generation from images
const generatingPdf = ref(false)
const generatedPdfUrl = ref('')
const generatedPdfBlob = ref<Blob | null>(null)

// Revision note
const revisionNote = ref('')

// Submit state
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

// Check if uploaded PDF has selectable text
async function checkPdfHasText(file: File): Promise<{ hasText: boolean; pageCount: number; text: string; avgCharsPerPage: number }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''
  let totalChars = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(' ')
    totalChars += pageText.trim().length
    fullText += pageText + '\n'
  }

  const avgCharsPerPage = totalChars / pdf.numPages
  // A catalog page with real OCR text should have at least 100 chars per page
  const hasText = avgCharsPerPage > 100

  return { hasText, pageCount: pdf.numPages, text: fullText, avgCharsPerPage }
}

// Process PDF without text - extract pages, run OCR, create new PDF with text layer
async function processPdfWithOcr(file: File): Promise<Blob> {
  pdfOcrProcessing.value = true
  pdfOcrProgress.value = 0

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const Tesseract = await import('tesseract.js')

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const newPdfDoc = await PDFDocument.create()
    const font = await newPdfDoc.embedFont(StandardFonts.Helvetica)

    const worker = await Tesseract.createWorker('eng')
    const totalSteps = pdf.numPages * 2 // render + OCR for each page

    for (let i = 1; i <= pdf.numPages; i++) {
      // Render page to image
      const page = await pdf.getPage(i)
      const scale = 2
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
      pdfOcrProgress.value = Math.round(((i * 2 - 1) / totalSteps) * 100)

      // Run OCR on the rendered image
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const { data } = await worker.recognize(imageDataUrl)
      pdfOcrProgress.value = Math.round(((i * 2) / totalSteps) * 100)

      // Create page in new PDF
      const imgBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
      })
      const imgBytes = await imgBlob.arrayBuffer()
      const image = await newPdfDoc.embedJpg(imgBytes)

      const newPage = newPdfDoc.addPage([image.width, image.height])
      newPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })

      // Add invisible text layer from OCR
      if (data.words && data.words.length > 0) {
        const scaleX = image.width / canvas.width
        const scaleY = image.height / canvas.height

        for (const word of data.words) {
          if (!word.text.trim()) continue

          const x = word.bbox.x0 * scaleX
          const y = image.height - (word.bbox.y1 * scaleY)
          const wordHeight = (word.bbox.y1 - word.bbox.y0) * scaleY
          const fontSize = Math.max(6, Math.min(wordHeight * 0.8, 20))

          try {
            newPage.drawText(word.text, {
              x,
              y,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
              opacity: 0, // Invisible - just for selection
            })
          } catch {
            // Skip words with unsupported characters
          }
        }
      }
    }

    await worker.terminate()

    const pdfBytes = await newPdfDoc.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } finally {
    pdfOcrProcessing.value = false
  }
}

// Handle PDF file selection
async function handlePdfSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || file.type !== 'application/pdf') return

  pdfFile.value = file
  pdfPreviewUrl.value = URL.createObjectURL(file)
  processedPdfBlob.value = null
  processedPdfUrl.value = ''

  try {
    const { hasText, pageCount } = await checkPdfHasText(file)
    pdfHasText.value = hasText
    pdfPageCount.value = pageCount
    pdfNeedsOcr.value = !hasText
  } catch (e) {
    console.error('Failed to analyze PDF:', e)
    pdfNeedsOcr.value = true // Assume needs OCR if analysis fails
  }

  input.value = ''
}

// Run OCR on PDF
async function runPdfOcr() {
  if (!pdfFile.value) return

  try {
    const processedBlob = await processPdfWithOcr(pdfFile.value)
    processedPdfBlob.value = processedBlob
    if (processedPdfUrl.value) URL.revokeObjectURL(processedPdfUrl.value)
    processedPdfUrl.value = URL.createObjectURL(processedBlob)
    pdfHasText.value = true
    pdfNeedsOcr.value = false
  } catch (e) {
    console.error('PDF OCR failed:', e)
  }
}

// Handle image file selection
function handleImageSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return

  for (const file of Array.from(input.files)) {
    if (!file.type.startsWith('image/')) continue

    images.value.push({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      pageNumber: images.value.length + 1,
    })
  }

  mode.value = 'images'
  input.value = ''
}

function removeImage(id: string) {
  const idx = images.value.findIndex(i => i.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(images.value[idx].preview)
    images.value.splice(idx, 1)
    // Renumber pages
    images.value.forEach((img, i) => {
      img.pageNumber = i + 1
    })
  }
}

// Run OCR on images
async function runOCR() {
  if (images.value.length === 0) return

  ocrProcessing.value = true
  ocrProgress.value = 0

  try {
    const Tesseract = await import('tesseract.js')
    const worker = await Tesseract.createWorker('eng')

    for (let i = 0; i < images.value.length; i++) {
      const img = images.value[i]
      img.ocrProcessing = true

      try {
        const { data } = await worker.recognize(img.preview)
        img.ocrText = data.text
      } catch (e) {
        console.error('OCR failed for image', i, e)
      }

      img.ocrProcessing = false
      ocrProgress.value = Math.round(((i + 1) / images.value.length) * 100)
    }

    await worker.terminate()
  } catch (e) {
    console.error('OCR failed:', e)
  } finally {
    ocrProcessing.value = false
  }
}

// Generate PDF from images with OCR text layer
async function generatePdfFromImages() {
  if (images.value.length === 0) return

  generatingPdf.value = true

  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Sort images by page number
    const sortedImages = [...images.value].sort((a, b) => a.pageNumber - b.pageNumber)

    for (const img of sortedImages) {
      const response = await fetch(img.preview)
      const imageBytes = await response.arrayBuffer()

      let image
      if (img.file.type === 'image/png') {
        image = await pdfDoc.embedPng(imageBytes)
      } else {
        image = await pdfDoc.embedJpg(imageBytes)
      }

      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      })

      // Add OCR text as invisible layer if available
      if (img.ocrText) {
        const lines = img.ocrText.split('\n')
        const lineHeight = 12
        let y = image.height - 20

        for (const line of lines) {
          if (line.trim() && y > 0) {
            try {
              page.drawText(line, {
                x: 10,
                y,
                size: 10,
                font,
                color: rgb(0, 0, 0),
                opacity: 0,
              })
              y -= lineHeight
            } catch {
              // Skip lines with unsupported characters
            }
          }
        }
      }
    }

    const pdfBytes = await pdfDoc.save()
    generatedPdfBlob.value = new Blob([pdfBytes], { type: 'application/pdf' })
    generatedPdfUrl.value = URL.createObjectURL(generatedPdfBlob.value)
  } catch (e) {
    console.error('PDF generation failed:', e)
  } finally {
    generatingPdf.value = false
  }
}

// Submit the catalog
async function handleSubmit() {
  if (!selectedYear.value || !selectedSeason.value) {
    submitError.value = 'Please select year and season'
    return
  }

  // Must have either a PDF or images
  if (!pdfFile.value && images.value.length === 0) {
    submitError.value = 'Please upload a PDF or images'
    return
  }

  submitting.value = true
  submitError.value = ''

  try {
    let finalPdfUrl: string
    let pageCount: number
    let hasOcr: boolean
    let ocrText: string | undefined

    if (pdfFile.value) {
      // Use processed PDF if OCR was run, otherwise use original
      const pdfToUpload = processedPdfBlob.value
        ? new File([processedPdfBlob.value], pdfFile.value.name, { type: 'application/pdf' })
        : pdfFile.value

      finalPdfUrl = await uploadFile(pdfToUpload, 'catalogs')
      pageCount = pdfPageCount.value
      hasOcr = pdfHasText.value
    } else {
      // Generate PDF from images first if not already done
      if (!generatedPdfBlob.value) {
        await generatePdfFromImages()
      }

      if (!generatedPdfBlob.value) {
        throw new Error('Failed to generate PDF from images')
      }

      // Upload the generated PDF
      const pdfFileName = `catalog-${selectedSeason.value}-${selectedYear.value}-${selectedRegion.value}.pdf`
      const pdfFileToUpload = new File([generatedPdfBlob.value], pdfFileName, { type: 'application/pdf' })
      finalPdfUrl = await uploadFile(pdfFileToUpload, 'catalogs')
      pageCount = images.value.length
      hasOcr = images.value.some(i => i.ocrText)
      ocrText = images.value.map(i => i.ocrText || '').join('\n---PAGE---\n')
    }

    // Submit to API
    await $fetch('/api/catalogs', {
      method: 'POST',
      body: {
        year: selectedYear.value,
        season: selectedSeason.value,
        region: selectedRegion.value,
        pdfUrl: finalPdfUrl,
        pageCount,
        hasOcr,
        ocrText,
        revisionNote: revisionNote.value || 'Initial upload',
      },
    })

    submitSuccess.value = true
  } catch (e: any) {
    submitError.value = e.message || 'Failed to submit catalog'
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  pdfFile.value = null
  if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value)
  pdfPreviewUrl.value = ''
  pdfPageCount.value = 0
  pdfHasText.value = false
  pdfNeedsOcr.value = false
  if (processedPdfUrl.value) URL.revokeObjectURL(processedPdfUrl.value)
  processedPdfUrl.value = ''
  processedPdfBlob.value = null
  images.value.forEach(i => URL.revokeObjectURL(i.preview))
  images.value = []
  if (generatedPdfUrl.value) URL.revokeObjectURL(generatedPdfUrl.value)
  generatedPdfUrl.value = ''
  generatedPdfBlob.value = null
  revisionNote.value = ''
  mode.value = 'select'
  submitSuccess.value = false
  submitError.value = ''
}

onUnmounted(() => {
  if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value)
  if (processedPdfUrl.value) URL.revokeObjectURL(processedPdfUrl.value)
  images.value.forEach(i => URL.revokeObjectURL(i.preview))
  if (generatedPdfUrl.value) URL.revokeObjectURL(generatedPdfUrl.value)
})
</script>

<template>
  <div class="px-4 py-8 max-w-4xl mx-auto">
    <!-- Header -->
    <section class="mb-8">
      <NuxtLink to="/database/catalogs" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
        ← Back to Catalogs
      </NuxtLink>
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-2">
        Upload Catalog
      </h1>
      <p class="text-muted dark:text-ash">
        Help us document Pandora catalogs. Uploads require admin approval.
      </p>
    </section>

    <!-- Success State -->
    <div v-if="submitSuccess" class="text-center py-16 bg-light-card dark:bg-dark-card rounded-lg">
      <div class="text-6xl mb-4">🎉</div>
      <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">Thank You!</h2>
      <p class="text-muted dark:text-ash mb-6">
        Your catalog has been submitted for review. An admin will approve it soon.
      </p>
      <div class="flex gap-4 justify-center">
        <NuxtLink to="/database/catalogs" class="btn btn-secondary">View Catalogs</NuxtLink>
        <button @click="resetForm" class="btn btn-primary">Upload Another</button>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Error -->
      <div v-if="submitError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
        {{ submitError }}
      </div>

      <!-- Catalog Details -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Catalog Details</h3>
        <div class="grid md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Year *</label>
            <select v-model="selectedYear" class="form-input">
              <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Season *</label>
            <select v-model="selectedSeason" class="form-input">
              <option value="">Select season...</option>
              <option v-for="season in seasons" :key="season" :value="season">{{ season }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Region</label>
            <select v-model="selectedRegion" class="form-input">
              <option v-for="region in regions" :key="region" :value="region">{{ region }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Upload Section -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Upload</h3>

        <!-- No file selected yet -->
        <div v-if="mode === 'select' && !pdfFile" class="grid md:grid-cols-2 gap-4">
          <!-- PDF Upload -->
          <label class="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-8 text-center cursor-pointer hover:border-rose-primary transition-colors">
            <div class="text-4xl mb-3">📄</div>
            <p class="text-ink dark:text-pearl font-medium mb-1">Upload PDF</p>
            <p class="text-sm text-muted dark:text-ash">Best option - preserves quality and any existing text</p>
            <input type="file" accept="application/pdf" class="hidden" @change="handlePdfSelect" />
          </label>

          <!-- Image Upload -->
          <label class="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-8 text-center cursor-pointer hover:border-rose-primary transition-colors">
            <div class="text-4xl mb-3">🖼️</div>
            <p class="text-ink dark:text-pearl font-medium mb-1">Upload Images</p>
            <p class="text-sm text-muted dark:text-ash">For scanned pages - we'll generate a PDF</p>
            <input type="file" accept="image/*" multiple class="hidden" @change="handleImageSelect" />
          </label>
        </div>

        <!-- PDF Selected -->
        <div v-else-if="pdfFile" class="space-y-4">
          <div class="flex items-start gap-4 p-4 bg-light-bg dark:bg-dark-elevated rounded-lg">
            <div class="text-4xl">📄</div>
            <div class="flex-1">
              <p class="font-medium text-ink dark:text-pearl">{{ pdfFile.name }}</p>
              <p class="text-sm text-muted dark:text-ash">{{ pdfPageCount }} pages</p>
              <div class="flex items-center gap-2 mt-2">
                <span
                  class="px-2 py-1 text-xs rounded"
                  :class="pdfHasText ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
                >
                  {{ pdfHasText ? 'Has selectable text' : 'No selectable text (scanned)' }}
                </span>
                <span v-if="processedPdfBlob" class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  OCR processed
                </span>
              </div>
            </div>
            <button type="button" @click="pdfFile = null; pdfPreviewUrl = ''; processedPdfBlob = null" class="text-red-500 hover:text-red-700">
              Remove
            </button>
          </div>

          <!-- OCR Processing -->
          <div v-if="!processedPdfBlob" class="p-4 rounded-lg" :class="pdfNeedsOcr ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-light-bg dark:bg-dark-elevated'">
            <h4 class="font-medium mb-2" :class="pdfNeedsOcr ? 'text-amber-800 dark:text-amber-300' : 'text-ink dark:text-pearl'">
              {{ pdfNeedsOcr ? 'This PDF likely needs OCR' : 'Run OCR (optional)' }}
            </h4>
            <p class="text-sm mb-3" :class="pdfNeedsOcr ? 'text-amber-700 dark:text-amber-400' : 'text-muted dark:text-ash'">
              {{ pdfNeedsOcr
                ? 'The PDF appears to be scanned images. Run OCR to make text searchable and selectable.'
                : 'If the PDF is scanned or text selection doesn\'t work, run OCR to add a text layer.' }}
            </p>
            <button
              type="button"
              @click="runPdfOcr"
              :disabled="pdfOcrProcessing"
              class="btn text-sm"
              :class="pdfNeedsOcr ? 'btn-primary' : 'btn-secondary'"
            >
              {{ pdfOcrProcessing ? `Processing... ${pdfOcrProgress}%` : 'Run OCR on PDF' }}
            </button>
          </div>

          <!-- OCR Progress -->
          <div v-if="pdfOcrProcessing" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p class="text-blue-700 dark:text-blue-400 text-sm mb-2">Processing OCR... This may take a while for large PDFs.</p>
            <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full transition-all" :style="{ width: `${pdfOcrProgress}%` }"></div>
            </div>
          </div>

          <!-- PDF Preview -->
          <div class="aspect-[3/4] max-h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <iframe :src="processedPdfUrl || pdfPreviewUrl" class="w-full h-full"></iframe>
          </div>

          <!-- Download processed PDF -->
          <div v-if="processedPdfUrl" class="flex justify-end">
            <a :href="processedPdfUrl" download="catalog-with-ocr.pdf" class="btn btn-secondary text-sm">
              Download OCR'd PDF
            </a>
          </div>
        </div>

        <!-- Images Selected -->
        <div v-else-if="mode === 'images'" class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-ink dark:text-pearl">{{ images.length }} image(s) selected</p>
            <div class="flex gap-2">
              <label class="btn btn-secondary text-sm cursor-pointer">
                Add More
                <input type="file" accept="image/*" multiple class="hidden" @change="handleImageSelect" />
              </label>
              <button type="button" @click="images = []; mode = 'select'" class="btn btn-secondary text-sm text-red-500">
                Clear All
              </button>
            </div>
          </div>

          <!-- Image Grid -->
          <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div
              v-for="img in images"
              :key="img.id"
              class="relative aspect-[3/4] bg-light-bg dark:bg-dark-elevated rounded overflow-hidden group"
            >
              <img :src="img.preview" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button type="button" @click="removeImage(img.id)" class="text-white text-2xl">&times;</button>
              </div>
              <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs py-1 text-center">
                Page {{ img.pageNumber }}
              </div>
              <div v-if="img.ocrText" class="absolute top-1 right-1 px-1 bg-green-500 text-white text-xs rounded">OCR</div>
              <div v-if="img.ocrProcessing" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span class="text-white text-xs">Processing...</span>
              </div>
            </div>
          </div>

          <!-- OCR Tools -->
          <div class="p-4 bg-light-bg dark:bg-dark-elevated rounded-lg">
            <h4 class="font-medium text-ink dark:text-pearl mb-2">Text Recognition (OCR)</h4>
            <p class="text-xs text-muted dark:text-ash mb-3">
              Run OCR to make text in the catalog searchable and selectable in the PDF.
            </p>
            <button
              type="button"
              @click="runOCR"
              :disabled="ocrProcessing || images.length === 0"
              class="btn btn-secondary text-sm"
            >
              {{ ocrProcessing ? `Processing... ${ocrProgress}%` : 'Run OCR' }}
            </button>
          </div>

          <!-- Generate PDF Preview -->
          <div v-if="images.length > 0" class="p-4 bg-light-bg dark:bg-dark-elevated rounded-lg">
            <h4 class="font-medium text-ink dark:text-pearl mb-2">Preview PDF</h4>
            <div class="flex gap-2">
              <button
                type="button"
                @click="generatePdfFromImages"
                :disabled="generatingPdf"
                class="btn btn-secondary text-sm"
              >
                {{ generatingPdf ? 'Generating...' : 'Generate Preview' }}
              </button>
              <a
                v-if="generatedPdfUrl"
                :href="generatedPdfUrl"
                download="catalog-preview.pdf"
                class="btn btn-secondary text-sm"
              >
                Download Preview
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Revision Note -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Revision Note</h3>
        <textarea
          v-model="revisionNote"
          placeholder="Describe what you're uploading (e.g., 'Full catalog scan', 'Better quality version', 'Missing pages added')"
          class="form-input min-h-[80px]"
        ></textarea>
      </section>

      <!-- Submit -->
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="submitting || (!pdfFile && images.length === 0)"
      >
        {{ submitting ? 'Uploading...' : 'Submit for Review' }}
      </button>

      <!-- Info -->
      <p class="text-center text-sm text-muted dark:text-ash">
        Submissions are reviewed by admins before being published.
      </p>
    </form>
  </div>
</template>
