import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const chars = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
const framesDir = path.join(__dirname, 'frames2'); 
const width = 200;

export async function renderFrame(filePath, width) {
    const image = await Jimp.read(filePath);

    
    const targetWidth = width; 
    const aspectRatio = image.bitmap.height / image.bitmap.width;
    const fontCorrection = 0.6;
    
    const targetHeight = Math.round(targetWidth * aspectRatio * fontCorrection);
    image.resize({ w: targetWidth, h: targetHeight }).greyscale();

   
    image.contrast(0.9);

    let ascii = '';
    for (let y = 0; y < image.bitmap.height; y++) {
        for (let x = 0; x < image.bitmap.width; x++) {
            const pixelIndex = (y * image.bitmap.width + x) * 4;
            const r = image.bitmap.data[pixelIndex];

            
            const charIdx = Math.floor((r / 255) * (chars.length - 1));

            ascii += chars[charIdx] || ' ';
        }
        ascii += '\n';
    }
    return ascii;
}

async function play() {
    if (!fs.existsSync(framesDir)) {
        console.error(`Папка не найдена: ${framesDir}`);
        return;
    }

    const files = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .sort();

    for (const file of files) {
        const frame = await renderFrame(path.join(framesDir, file));
        console.clear();
        console.log(frame);
        await new Promise(resolve => setTimeout(resolve, 33));
    }
}



const qualities = [50, 100, 200, 300, 400, 600];

export async function saveMegaJson() {
    if (!fs.existsSync(framesDir)) {
        console.error(`Папка не найдена: ${framesDir}`);
        return;
    }

    const files = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .sort();

    const megaData = {};

    console.log("🚀 Начинаем глобальный рендер всех уровней качества...");

    for (const q of qualities) {
        console.log(`\nОбработка качества: ${q} символов`);
        const frames = [];

        for (let i = 0; i < files.length; i++) {
           
            const frameContent = await renderFrame(path.join(framesDir, files[i]), q);
            frames.push(frameContent);

            process.stdout.write(`\r[${q}] Прогресс: ${Math.round(((i + 1) / files.length) * 100)}% (${i + 1}/${files.length})`);
        }
        megaData[q] = frames;
    }

    const outputPath = path.join(__dirname, 'frames.json');
    fs.writeFileSync(outputPath, JSON.stringify(megaData));

    const stats = fs.statSync(outputPath);
    console.log(`\n\n✅ Готово!`);
    console.log(`📁 Файл: ${outputPath}`);
    console.log(`⚖️ Размер: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}


saveMegaJson().catch(console.error);


