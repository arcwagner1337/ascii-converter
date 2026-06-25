const express = require('express');
const multer = require('multer'); 
const sharp = require('sharp');  
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GifWriter } = require('omggif');
const PImage = require('pureimage');
const puppeteer = require('puppeteer');
const { PNG } = require('pngjs');

const app = express();

app.use(cors({
    origin: 'http://localhost:3001', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
const upload = multer({ dest: 'uploads/' }); 


const chars = "@#S%?*+;:,. ";

app.post('/convert', upload.single('gif'), async (req, res) => {
    console.log("--- Начало обработки ---");
    if (!req.file) return res.status(400).send('Файл потерялся в пути');

    const targetWidth = parseInt(req.body.quality) || 100;

    const gifPath = path.resolve(req.file.path);
    const tempDir = path.resolve(__dirname, '../temp_frames');

    try {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        console.log("1. Папка temp_frames готова");

       
        try {
            console.log("2. Запускаю FFmpeg...");
            
            execSync(`ffmpeg -y -i "${gifPath}" "${path.join(tempDir, 'frame_%03d.png')}"`);
            console.log("3. FFmpeg успешно нарезал кадры");
        } catch (fErr) {
            console.error("ОШИБКА НА ШАГЕ FFmpeg:", fErr.message);
            return res.status(500).send("Сервер не смог запустить FFmpeg. Проверь, установлен ли он.");
        }

        const frames = fs.readdirSync(tempDir).filter(f => f.endsWith('.png')).sort();
        console.log(`4. Найдено кадров: ${frames.length}`);

        const asciiResult = [];

        for (const frame of frames) {
            const framePath = path.join(tempDir, frame);

           
            const metadata = await sharp(framePath).metadata();
            const aspect = metadata.height / metadata.width;

            
            const targetHeight = Math.round(targetWidth * aspect * 0.59);

            const { data, info } = await sharp(framePath)
                .resize(targetWidth, targetHeight, {
                    fit: 'fill' 
                })
                .grayscale()
                .linear(1.3, -30)
                .raw()
                .toBuffer({ resolveWithObject: true });

            let asciiFrame = "";
            for (let i = 0; i < data.length; i++) {
                asciiFrame += chars[Math.floor((data[i] / 255) * (chars.length - 1))];
                
                if ((i + 1) % info.width === 0) asciiFrame += "\n";
            }
            asciiResult.push(asciiFrame);
            fs.unlinkSync(framePath);
        }

       

        fs.unlinkSync(gifPath);
        console.log("5. Все готово, отправляю ответ");
        res.json({ "100": asciiResult });

    } catch (err) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА:", err);
        res.status(500).json({ error: err.message });
    }
});


app.post('/export-gif', express.json({ limit: '50mb' }), async (req, res) => {
    let browser;
    try {
        const { frames, palette, quality } = req.body; 

        const RENDER_WIDTH = 900;
        const RENDER_HEIGHT = 600;
        const fontScale = 0.59;

        const htmlContent = `
    <style>
        body, html { 
            margin: 0; padding: 0; background: black; 
            width: ${RENDER_WIDTH}px;
            overflow: hidden; 
        }
        .container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center; /* Центрируем как в консоли */
            justify-content: center;
            container-type: inline-size;
        }
        pre {
            font-family: 'Courier New', monospace;
            white-space: pre;
            line-height: 0.82;
            letter-spacing: -0.01em;
            color: ${palette};
            /* Используем твою формулу */
            font-size: calc(100cqw / ${quality} * 1.75); 
            margin: 0;
            text-align: center;
            font-weight: bold;
        }
    </style>
    <div class="container">
        <pre id="ascii"></pre>
    </div>
`;

        

        const isLinux = process.platform === 'linux';

        const launchOptions = {
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-font-subpixel-positioning',
                '--font-render-hinting=none'
            ]
        };

        if (!isLinux) {
            launchOptions.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        } else if (process.env.CHROME_PATH) {
            launchOptions.executablePath = process.env.CHROME_PATH; 
        }

        browser = await puppeteer.launch(launchOptions);


        const page = await browser.newPage();
        
        await page.setViewport({ width: RENDER_WIDTH, height: 2000 });
        await page.setContent(htmlContent);

        
        const testFrame = frames.length > 5 ? frames[5] : frames[0];
        await page.evaluate((text) => {
            const el = document.getElementById('ascii');
            el.innerText = text;
        }, testFrame);

       
        const measuredHeight = await page.evaluate(() => {
            const el = document.getElementById('ascii');
            const rect = el.getBoundingClientRect();
            return Math.ceil(rect.height);
        });

       
        const finalHeight = measuredHeight + 5;

       
        await page.setViewport({ width: RENDER_WIDTH, height: finalHeight });

        console.log(`[DEBUG] Высота пересчитана: ${RENDER_WIDTH}x${finalHeight}`);

        
        const debugPath = path.join(__dirname, 'debug_frame.png');
        await page.screenshot({ path: debugPath });

        
        const buffer = Buffer.alloc(RENDER_WIDTH * finalHeight * frames.length + 10 * 1024 * 1024);
        const gif = new GifWriter(buffer, RENDER_WIDTH, finalHeight, { loop: 0 });
        const colorInt = parseInt(palette.replace('#', ''), 16);

        
        for (const frameText of frames) {
            await page.evaluate((t) => {
                document.getElementById('ascii').innerText = t;
            }, frameText);

            const pngRaw = await page.screenshot({ type: 'png' });
            
            const pngBuffer = Buffer.from(pngRaw);
            const png = PNG.sync.read(pngBuffer);

            const pixels = new Uint8Array(RENDER_WIDTH * finalHeight);
            for (let i = 0; i < pixels.length; i++) {
                const r = png.data[i * 4];     
                const g = png.data[i * 4 + 1]; 
                const b = png.data[i * 4 + 2]; 
                pixels[i] = (r > 40 || g > 40 || b > 40) ? 1 : 0;
            }

            gif.addFrame(0, 0, RENDER_WIDTH, finalHeight, pixels, {
                palette: [0x000000, colorInt],
                delay: 10
            });
        }
        res.set({ 'Content-Type': 'image/gif' });
        res.end(buffer.subarray(0, gif.end()));

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    } finally {
        if (browser) await browser.close();
    }
});



app.listen(3002, () => console.log('Backend running on port 3002'));