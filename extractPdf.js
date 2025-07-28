import fs from 'fs';
import PDFParser from 'pdf2json';

export const extractTextFromPdfFile = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);

    const parser = new PDFParser(null, 1);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PDF parsing timeout (30 seconds)'));
      }, 30000);

      parser.on("pdfParser_dataError", err => {
        clearTimeout(timeout);
        reject(new Error(`PDF parsing failed: ${err.parserError || err.message}`));
      });

      parser.on("pdfParser_dataReady", pdfData => {
        clearTimeout(timeout);

        try {
          let pages = null;
          if (pdfData?.Pages) {
            pages = pdfData.Pages;
          } else if (pdfData?.formImage?.Pages) {
            pages = pdfData.formImage.Pages;
          } else if (pdfData?.data?.Pages) {
            pages = pdfData.data.Pages;
          }

          if (!pages || !Array.isArray(pages)) {
            return reject(new Error("PDF data does not contain readable Pages."));
          }
          if (pages.length === 0) {
            return reject(new Error("PDF contains no pages"));
          }

          const rawText = pages.map(page => {
            if (!page.Texts || !Array.isArray(page.Texts)) return '';
            return page.Texts.map(text => {
              if (!text.R || !Array.isArray(text.R)) return '';
              return text.R.map(r => decodeURIComponent(r.T || '')).join('');
            }).join(' ');
          }).join(' ');

          if (!rawText.trim()) {
            return reject(new Error("PDF contains no extractable text"));
          }

          // Clean text: remove single-letter words (optional)
          const words = rawText
            .replace(/\s+/g, ' ')
            .split(' ')
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length > 1);

          resolve(words);
        } catch (e) {
          reject(new Error(`Failed to process PDF content: ${e.message}`));
        }
      });

      parser.parseBuffer(buffer);
    });

  } catch (error) {
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
};

