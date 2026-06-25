
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import asciiFramesRaw from './frames.json';

console.log('RAW DATA:', asciiFramesRaw)




const AsciiTerminal: React.FC = () => {
    const [asciiFrames, setAsciiFrames] = useState<Record<string, string[]>>(asciiFramesRaw as any);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scales, setScales] = useState({ ascii: 1, ui: 1 });
    const [frameIndex, setFrameIndex] = useState(0);
    const [isRunning, setIsRunning] = useState(true);

    const [fps, setFps] = useState(0);
    const lastTimeRef = useRef(performance.now());
    const framesRef = useRef(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLPreElement>(null);

    const [isUserUploaded, setIsUserUploaded] = useState(false);

    const [settings, setSettings] = useState({
        renderQuality: 300, 
        speed: 1.0,
        palette: '#10b981'
    });

    const currentTheme = useMemo(() => ({
        primary: settings.palette,
        secondary: `${settings.palette}1a`, 
        ghost: `${settings.palette}66`     
    }), [settings.palette]);

  
    const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

    const [showSettings, setShowSettings] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const settingsOptions = [
        {
            label: 'PLAYBACK_SPEED',
            value: `x${settings.speed}`,
            action: () => setActiveSubMenu('SPEED')
        },
        {
            label: 'COLOR_PALETTE',
            value: settings.palette,
            action: () => setActiveSubMenu('PALETTE')
        },
        { label: 'RENDER_QUALITY', value: `${settings.renderQuality}ch`, action: () => setActiveSubMenu('RENDER_QUALITY') },

        {
            label: 'UPLOAD_NEW_GIF',
            value: 'READY',
            action: () => setActiveSubMenu('UPLOAD')
        },

       
    ];
    
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);


    const lastFileRef = useRef<File | null>(null);

  
    const reprocessGif = async (file: File, quality: number) => {
        const formData = new FormData();
        formData.append('gif', file);
        formData.append('quality', String(quality));

        try {
            setIsProcessing(true);
           
            const response = await fetch('/api/convert', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Ошибка сервера');
            const data = await response.json();

            setAsciiFrames(prev => ({
                ...prev,
                [String(quality)]: data[String(quality)] || data["100"]
            }));
            setFrameIndex(0);

            setIsUserUploaded(true);
        } catch (error) {
            console.error("Сервер обиделся:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        lastFileRef.current = file; 
        await reprocessGif(file, settings.renderQuality);
        setActiveSubMenu(null);
    };

    const downloadAsciiGif = async () => {
        
        const frames = asciiFrames[String(settings.renderQuality)];

        if (!frames || frames.length === 0) {
            alert("BUFFER_EMPTY: Сначала загрузи или сгенерируй анимку");
            return;
        }

        try {
            setIsProcessing(true); 

            
            const response = await fetch('/api/export-gif', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frames,
                    quality: settings.renderQuality,
                    palette: settings.palette
                })
            });

            if (!response.ok) throw new Error('Ошибка генерации на сервере');

         
            
            const buffer = await response.arrayBuffer();
            const blob = new Blob([buffer], { type: 'image/gif' });
            console.log("Final Blob size:", blob.size);
            console.log("РАЗМЕР ПОЛУЧЕННОГО ФАЙЛА:", blob.size, "bytes");

            if (blob.size < 100) {
                throw new Error("Получен пустой или слишком маленький файл");
            }

        
            const gifBlob = new Blob([blob], { type: 'image/gif' });
            const url = URL.createObjectURL(gifBlob);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `terminal_ascii_${Date.now()}.gif`);

         
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });

            link.dispatchEvent(clickEvent);

          
            setTimeout(() => {
                URL.revokeObjectURL(url);
                console.log("URL почищен");
            }, 5000); 
        } catch (err) {
            console.error("EXPORT_ERROR:", err);
            alert("Ошибка при экспорте GIF. Проверь консоль бэкенда.");
        } finally {
            setIsProcessing(false);
        }
    };


    useEffect(() => {
        const checkDevice = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const ratio = width / height;

            const mobileCandidate = width < 500 || ratio < 0.65;

            const tabletCandidate = !mobileCandidate && width < 1100 && ratio < 1.5;

            setIsMobile(mobileCandidate);
            setIsTablet(tabletCandidate);
        };

        window.addEventListener('resize', checkDevice);
        checkDevice();
        return () => window.removeEventListener('resize', checkDevice);
    }, []);


    const mobileScale = (window.innerWidth / 360) * 0.95;

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    const rgbToHex = (r: number, g: number, b: number) =>
        "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);



    const AsciiDisplay = React.memo(({ frame, color, quality }: { frame: string, color: string, quality: number }) => (
        <div
            className="w-full h-full flex items-center justify-center overflow-hidden bg-black/20"
            style={{ containerType: 'inline-size' } as any} 
        >
            <pre
                className="font-mono whitespace-pre leading-[0.82] tracking-[-0.01em]"
                style={{
                    color: color,
                    fontSize: `calc(100cqw / ${quality} * 1.75)`,
                    margin: 0,
                    textAlign: 'center',
                    display: 'block',
                    width: '100%',
                }}
            >
                {frame}
            </pre>
        </div>
    ));


    useEffect(() => {
        const updateFps = () => {
            framesRef.current++;
            const now = performance.now();
            if (now - lastTimeRef.current >= 1000) {
                setFps(framesRef.current);
                framesRef.current = 0;
                lastTimeRef.current = now;
            }
            requestAnimationFrame(updateFps);
        };
        const id = requestAnimationFrame(updateFps);
        return () => cancelAnimationFrame(id);
    }, []);


    const updateScale = () => {
        if (containerRef.current && measureRef.current) {
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const baseW = 1000;
            const baseH = 650;

            const scaleW = (vw * 0.92) / baseW;
            const scaleH = (vh * 0.90) / baseH;


            let mainScale = Math.min(scaleW, scaleH);

  
            mainScale = Math.min(Math.max(mainScale, 0.3), 2.0);


            const mw = measureRef.current.offsetWidth;
            const mh = measureRef.current.offsetHeight;

            const asciiW = (baseW * 0.95) / mw;
            const asciiH = (baseH - 150) / mh; 

            setScales({
                ascii: Math.min(asciiW, asciiH),
                ui: mainScale
            });
        }
    };
    useLayoutEffect(() => {
        updateScale();

        window.addEventListener('resize', updateScale);
        return () => {
            window.removeEventListener('resize', updateScale);
        };
    }, [settings.renderQuality, asciiFrames]);


    useEffect(() => {
        const frames = asciiFrames[String(settings.renderQuality)];
        if (!isRunning || showSettings || !frames) return;

        const baseFps = 30; 
        const msPerFrame = 1000 / (baseFps * settings.speed);

        const interval = setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % frames.length);
        }, msPerFrame);

        return () => clearInterval(interval);
    }, [isRunning, showSettings, settings.speed, settings.renderQuality, asciiFrames]);

    useEffect(() => {
        setFrameIndex(0);
    }, [settings.renderQuality]);


    const theme = useMemo(() => {
        const ui = scales.ui;
        const isLowRes = window.innerHeight < 450;

        return {
            ui,
            isLowRes,
            font: `${15 * ui}px`,
            smallFont: `${10 * ui}px`,
            padding: isLowRes ? `${4 * ui}px ${10 * ui}px` : `${10 * ui}px ${20 * ui}px`,
            controlHeight: isLowRes ? `${35 * ui}px` : `${52 * ui}px`,
            iconSize: 18 * ui,
            borderWidth: `${Math.max(1, Math.round(1 * ui))}px`,
            borderRadius: `${Math.round(4 * ui)}px`,
        };
    }, [scales.ui]);

    const currentQuality = String(settings.renderQuality);
    const framesForQuality = asciiFrames[String(settings.renderQuality)] || [];


    if (isMobile || isTablet) {

        const renderMobileSettings = () => (
            <div className="absolute inset-0 z-[200] bg-black p-5 flex flex-col font-mono">
                <div
                    style={{ backgroundColor: currentTheme.primary, color: '#000' }}
                    className="flex-none flex justify-between items-center px-4 h-12 mb-6"
                >
                    <span className="font-bold text-sm">MOBILE BIOS V1.0</span>
                    <button onClick={() => setShowSettings(false)} className="font-black active:scale-80">[ X ]</button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                    {settingsOptions.map((opt, i) => (
                        <div
                            key={opt.label}
                            onClick={() => opt.action?.()}
                            style={{
                                borderColor: `${currentTheme.primary}44`,
                                color: currentTheme.primary,
                                backgroundColor: `${currentTheme.primary}0D`
                            }}
                            className="flex-none flex justify-between items-center p-5 border-2 active:scale-95"
                        >
                            <span className="font-bold uppercase text-xs">{opt.label}</span>
                            <span className="text-xs px-2 py-1 bg-white/5">{opt.value || '▶'}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t opacity-30 text-[10px]" style={{ color: currentTheme.primary, borderColor: currentTheme.primary }}>
                    KERNEL_RELEASE: 1.0.4-STABLE_MOBILE
                </div>
            </div>
        );

        const renderMobileSubMenu = () => {

            if (activeSubMenu === 'PALETTE') {
                const rgb = hexToRgb(settings.palette);

                return (
                    <div className="absolute inset-0 z-[300] bg-black/95 flex items-center justify-center p-4">
                        <div
                            className="w-full border-2 bg-black flex flex-col"
                            style={{ borderColor: currentTheme.primary }}
                        >

                            <div
                                style={{ backgroundColor: currentTheme.primary }}
                                className="text-black p-3 font-bold text-center uppercase text-sm"
                            >
                                Color Calibration
                            </div>

                            <div className="p-6 flex flex-col gap-8">
                                {['r', 'g', 'b'].map((channel) => {
                                    const value = rgb[channel as keyof typeof rgb];
                                    return (
                                        <div key={channel} className="flex flex-col gap-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] opacity-50 uppercase font-black" style={{ color: currentTheme.primary }}>
                                                    Channel_{channel}
                                                </span>
                                                <span className="text-xl font-mono leading-none" style={{ color: currentTheme.primary }}>
                                                    {value}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="255"
                                                value={value}
                                                onChange={(e) => {
                                                    const newValue = parseInt(e.target.value);
                                                    let newRgb = { ...rgb, [channel]: newValue };
                                                 
                                                    if (newRgb.r + newRgb.g + newRgb.b < 50) {
                                                        newRgb[channel as keyof typeof rgb] = 40;
                                                    }
                                                    setSettings(prev => ({
                                                        ...prev,
                                                        palette: rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                                                    }));
                                                }}
                                                className="w-full h-8 bg-transparent appearance-none cursor-pointer"
                                                style={{
                                                    accentColor: currentTheme.primary,
                                                    
                                                    background: `linear-gradient(to right, ${currentTheme.primary}44, ${currentTheme.primary}11)`
                                                }}
                                            />
                                        </div>
                                    );
                                })}

                        
                                <div className="mt-4 pt-6 border-t border-white/10 flex justify-between items-center">
                                    <div>
                                        <div className="text-[9px] opacity-40 uppercase">Hex_Output</div>
                                        <div className="text-2xl font-black" style={{ color: currentTheme.primary }}>
                                            {settings.palette.toUpperCase()}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setActiveSubMenu(null)}
                                        className="h-14 px-8 border-2 font-black active:scale-90 transition-all"
                                        style={{
                                            borderColor: currentTheme.primary,
                                            backgroundColor: currentTheme.primary,
                                            color: '#000'
                                        }}
                                    >
                                        DONE
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            if (activeSubMenu === 'UPLOAD') {
                return (
                    <div className="absolute inset-0 z-[300] bg-black/95 flex items-center justify-center p-4">
                        <div
                            className="w-full max-w-md border-2 bg-black flex flex-col transition-all duration-300"
                            style={{ borderColor: currentTheme.primary }}
                        >
                       
                            <div
                                style={{ backgroundColor: currentTheme.primary }}
                                className="text-black p-3 font-bold text-center uppercase text-sm flex justify-center items-center gap-2"
                            >
                                {isProcessing && <span className="animate-spin text-lg">◒</span>}
                                {isProcessing ? "Processing System Data" : "File System Upload"}
                            </div>

                            <div className="p-8 flex flex-col items-center gap-6">
                             
                                <div
                                    className={`w-full h-32 border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${isProcessing ? 'opacity-100' : 'active:bg-white/10'
                                        }`}
                                    style={{
                                        borderColor: isProcessing ? currentTheme.primary : `${currentTheme.primary}44`,
                                       
                                        animation: isProcessing ? 'pulse 1.5s infinite' : 'none'
                                    }}
                                    onClick={() => !isProcessing && document.getElementById('gif-upload')?.click()}
                                >
                                    {isProcessing ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <span
                                                style={{ color: currentTheme.primary }}
                                                className="text-[11px] uppercase font-black tracking-tighter animate-pulse"
                                            >
                                                [ Rendering_Ascii_Frames ]
                                            </span>
                                        
                                            <div className="w-40 h-[2px] bg-white/10 relative overflow-hidden">
                                                <div
                                                    className="absolute inset-0 bg-current animate-[loading_2s_infinite]"
                                                    style={{ backgroundColor: currentTheme.primary }}
                                                />
                                            </div>
                                            <span style={{ color: currentTheme.primary }} className="text-[8px] opacity-50 uppercase">
                                                Do not close terminal
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <span style={{ color: currentTheme.primary }} className="text-[10px] uppercase font-black opacity-60">
                                                Click to select .GIF
                                            </span>
                                            <div className="flex gap-1 items-center opacity-30">
                                                <div className="w-1 h-1 bg-current" style={{ color: currentTheme.primary }} />
                                                <span style={{ color: currentTheme.primary }} className="text-[8px]">RAW DATA INPUT</span>
                                                <div className="w-1 h-1 bg-current" style={{ color: currentTheme.primary }} />
                                            </div>
                                        </>
                                    )}

                                    <input
                                        id="gif-upload"
                                        type="file"
                                        accept="image/gif"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isProcessing}
                                    />
                                </div>

                            
                                <button
                                    disabled={isProcessing}
                                    onClick={() => setActiveSubMenu(null)}
                                    className="w-full h-12 border-2 font-black text-xs active:scale-95 transition-all"
                                    style={{
                                        borderColor: currentTheme.primary,
                                        color: currentTheme.primary,
                                        
                                        opacity: isProcessing ? 0.2 : 1,
                                        filter: isProcessing ? 'grayscale(1)' : 'none'
                                    }}
                                >
                                    {isProcessing ? "TASK_IN_PROGRESS" : "[ ABORT_MISSION ]"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }


            const options = activeSubMenu === 'RENDER_QUALITY' ? [50, 100, 200, 300, 400, 600] : [0.5, 1.0, 1.5, 2.0];


            return (
                <div className="absolute inset-0 z-[300] bg-black/95 flex items-center justify-center p-6">
                    <div
                        className="w-full border-2 p-2 bg-black"
                        style={{ borderColor: currentTheme.primary }}
                    >
                        <div style={{ backgroundColor: currentTheme.primary }} className="text-black p-3 font-bold text-center uppercase mb-2">
                            Select {activeSubMenu}
                        </div>
                        <div className="flex flex-col gap-2">
                            {options.map(val => {
                               
                                const isCurrentProcessing = isProcessing && activeSubMenu === 'RENDER_QUALITY' && settings.renderQuality === val;

                                return (
                                    <button
                                        key={val}
                                        disabled={isProcessing}
                                        onClick={() => {
                                            if (activeSubMenu === 'RENDER_QUALITY') {
                                                const newQuality = val as number;
                                                setSettings(p => ({ ...p, renderQuality: newQuality }));
                                                if (lastFileRef.current) {
                                                    reprocessGif(lastFileRef.current, newQuality);
                                                }
                                            } else {
                                                setSettings(p => ({ ...p, speed: val as number }));
                                                setActiveSubMenu(null); 
                                            }
                                         
                                            if (activeSubMenu !== 'RENDER_QUALITY') setActiveSubMenu(null);
                                        }}
                                        className="p-4 border font-bold active:scale-95 flex justify-between items-center transition-all"
                                        style={{
                                            borderColor: settings.renderQuality === val ? currentTheme.primary : `${currentTheme.primary}33`,
                                            backgroundColor: settings.renderQuality === val ? `${currentTheme.primary}15` : 'transparent',
                                            color: currentTheme.primary,
                                            opacity: isProcessing && !isCurrentProcessing ? 0.3 : 1, 
                                            cursor: isProcessing ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <span>
                                            {val} {activeSubMenu === 'SPEED' ? 'x' : ' UNIT'}
                                        </span>

                                       
                                        {isCurrentProcessing ? (
                                            <span className="animate-spin">◒</span>
                                        ) : (
                                            settings.renderQuality === val && <span>[SELECTED]</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            disabled={isProcessing}
                            onClick={() => setActiveSubMenu(null)}
                            className="w-full p-4 mt-2 text-xs opacity-50 font-bold"
                            style={{
                                color: currentTheme.primary, opacity: isProcessing ? 0.5 : 1,
                                cursor: isProcessing ? 'not-allowed' : 'pointer'
                            }}
                        >
                            [ CANCEL ]
                        </button>
                    </div>
                </div>
            );
        };

        const currentCharsPerRow = settings.renderQuality;
        const charWidth = 4.1;

        
        const consoleWidth = isTablet ? 450 : 350;
        const autoAsciiScale = (consoleWidth / (currentCharsPerRow * charWidth)) * 0.9;

        return (
            <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-2 font-mono overflow-hidden">
                <div
                    style={{
                        width: isTablet ? '450px' : '350px',
                       
                        height: isTablet ? '85dvh' : '90dvh',
                        maxHeight: isTablet ? '900px' : '650px',

                       
                        transform: isMobile
                            ? `scale(${Math.min(mobileScale, window.innerHeight / 700)})`
                            : 'none',

                        transformOrigin: 'center center',
                        border: `${theme.borderWidth} solid ${currentTheme.primary}`,
                        backgroundColor: '#000',
                        boxShadow: `0 0 40px ${currentTheme.secondary}`,
                        borderRadius: theme.borderRadius,

                        display: 'flex',
                        flexDirection: 'column',
                        
                        overflowY: 'auto',
                        overflowX: 'hidden'
                    }}
                    className="relative scrollbar-hide"
                >
                    
                    <div
                        className="flex-none flex items-center justify-between px-4 border-b transition-colors"
                        style={{
                            height: '45px',
                            borderColor: `${currentTheme.primary}33`,
                            backgroundColor: `${currentTheme.primary}0D`,
                            color: currentTheme.primary
                        }}
                    >
                        <span className="text-[11px] font-bold tracking-[0.2em]">SYS_V1.0_{isTablet ? 'TAB' : 'MOB'}</span>
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTheme.primary }} />
                        </div>
                    </div>

                    {!showSettings && (
                        <div className="flex-none text-center z-10 w-full py-4">
                            <h2 className="text-emerald-400 font-mono font-bold uppercase text-3xl tracking-tighter"
                                style={{ color: currentTheme.primary }}>
                                
                                ascii converter
                                
                            </h2>
                        </div>
                    )}

                    

                    <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden border-r border-white/5 bg-black/20">
                        <AsciiDisplay
                            frame={asciiFrames[String(settings.renderQuality)]?.[frameIndex] || ""}
                            color={currentTheme.primary}
                            quality={settings.renderQuality}
                        />
                    </div>

                 
                    <div
                        className="flex-none px-6 py-4 flex justify-between items-center border-t border-b"
                        style={{ borderColor: `${currentTheme.primary}1A`, backgroundColor: `${currentTheme.primary}05` }}
                    >
                        <div>
                            <div className="text-[10px] opacity-40 uppercase tracking-tighter" style={{ color: currentTheme.primary }}>System FPS</div>
                            <div className="text-2xl font-black leading-none" style={{ color: currentTheme.primary }}>{fps}</div>
                        </div>
                        
                    </div>

                    
                    <div className="flex-none p-4 flex flex-col gap-3 bg-black">
                       
                        <button
                            onClick={() => setIsRunning(!isRunning)}
                            className="w-full h-16 border-2 font-black uppercase tracking-widest active:scale-95 transition-all"
                            style={{
                                borderColor: currentTheme.primary,
                                color: isRunning ? '#000' : currentTheme.primary,
                                backgroundColor: isRunning ? currentTheme.primary : 'transparent',
                            }}
                        >
                            {isRunning ? '|| PAUSE' : '▶ EXECUTE'}
                        </button>

                        
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setShowSettings(true)}
                                className="flex-1 h-14 border-2 font-bold uppercase tracking-wider opacity-80 active:scale-95"
                                style={{
                                    borderColor: `${currentTheme.primary}66`,
                                    color: currentTheme.primary
                                }}
                            >
                                [ SETTINGS ]
                            </button>
                          
                            <button
                                onClick={downloadAsciiGif}
                                disabled={isProcessing}
                                className="w-20 h-14 border-2 flex items-center justify-center opacity-80 active:scale-95 disabled:opacity-30"
                                style={{
                                    borderColor: `${currentTheme.primary}66`,
                                    color: currentTheme.primary
                                }}
                                title="Export GIF"
                            >
                                {isProcessing ? (
                                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="block" 
                                    >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>


                  
                    {showSettings && renderMobileSettings()}
                    {activeSubMenu && renderMobileSubMenu()}
                </div>
            </div>
        );
    }

  

    const scaleX = 600 / (settings.renderQuality * 7.2); 

   
    const frameRows = (asciiFrames[String(settings.renderQuality)]?.[0]?.split('\n').length) || 1;
    const scaleY = 1000 / (frameRows * 12);

   
    const finalDesktopScale = Math.min(scaleX, scaleY) * 0.9;

    return (
        
        <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center overflow-hidden p-4">

           
            <div
                className="relative bg-black rounded-lg flex flex-col shadow-2xl overflow-hidden"
                style={{
                    width: '1000px',
                    height: '650px',
                    transform: `scale(${scales.ui})`,
                    transformOrigin: 'center center',
                    border: `${theme.borderWidth} solid ${currentTheme.primary}`,
                    borderRadius: theme.borderRadius,
                    flexShrink: 0,
                    boxShadow: `0 0 40px ${currentTheme.secondary}`
                }}
            >
                
                <div
                    className="flex-none w-full flex items-center justify-between px-6 bg-emerald-950/10 border-b border-emerald-900/20"
                    style={{
                        height: '45px',
                        color: currentTheme.primary,
                        borderColor: currentTheme.secondary,
                        backgroundColor: currentTheme.secondary 
                    }}                >
                    <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-red-500/50' : i === 1 ? 'bg-amber-500/50' : 'bg-emerald-500/50'}`}
                            />
                        ))}
                    </div>
                    <span className="font-mono text-emerald-500/50 uppercase tracking-[0.3em] text-[11px]"
                        style={{ color: `${currentTheme.primary}` }}>
                        SYSTEM_OS_V1.0
                    </span>
                </div>

               
                <div
                    ref={containerRef}
                    className="flex-1 min-h-0 relative flex flex-col items-center justify-center bg-black"
                >
                   
                    <pre
                        ref={measureRef}
                        className="absolute pointer-events-none opacity-0 font-mono leading-[0.8] tracking-[-0.05em] text-[12px] whitespace-pre"
                    >
                        {asciiFrames[String(settings.renderQuality)]?.[0]?.split('\n')[0] || ""}
                    </pre>

                   
                    {!showSettings && (
                        <div className="flex-none text-center z-10 w-full py-4">
                            <h2 className="text-emerald-400 font-mono font-bold uppercase text-3xl tracking-tighter"
                                style={{ color: currentTheme.primary }}>
                                
                                ascii converter
                                
                            </h2>
                        </div>
                    )}

                    {showSettings && (
                        <div
                            className="absolute inset-0 z-50 bg-[#00000] font-mono flex flex-col"
                            style={{
                                padding: '40px',
                                borderRadius: theme.borderRadius
                            }}
                        >
                           
                            <div
                                className="flex-none flex justify-between items-center bg-emerald-500 text-black px-4"
                                style={{
                                    height: '35px',
                                    marginBottom: '30px',
                                    backgroundColor: currentTheme.primary,
                                    color: '#000' 
                                }}
                            >
                                <span className="text-[14px] font-bold uppercase tracking-wider">
                                    Main Setup Utility - Advanced Settings
                                </span>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="text-[14px] font-bold px-4 h-full transition-all border-l border-black/20"
                                    style={{ color: '#000', backgroundColor: 'transparent' }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                                        e.currentTarget.style.color = '#000';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#000';
                                    }}
                                >
                                    [ EXIT ]
                                </button>
                            </div>

                      
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div
                                    className="grid grid-cols-1 gap-y-2 mx-auto w-full"
                                    style={{ maxWidth: '600px' }}
                                >
                                    {settingsOptions.map((opt, i) => (
                                        <div
                                            key={opt.label}
                                            onMouseEnter={() => setSelectedIndex(i)}
                                            onClick={() => opt.action?.()}
                                            style={{
                                                padding: '16px 20px',
                                                borderColor: selectedIndex === i ? currentTheme.primary : `${currentTheme.primary}33`, 
                                                backgroundColor: selectedIndex === i ? currentTheme.secondary : 'transparent',
                                                color: selectedIndex === i ? currentTheme.primary : currentTheme.ghost 
                                            }}
                                            className="flex justify-between items-center cursor-pointer transition-all border-2"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className={selectedIndex === i ? "opacity-100" : "opacity-0"}>▶</span>
                                                <span className="text-[16px] uppercase font-bold">
                                                    {opt.label}
                                                </span>
                                            </div>
                                            {opt.value && (
                                                <span
                                                    className="text-[14px] font-mono px-3 py-1 transition-colors"
                                                    style={{
                                                        backgroundColor: selectedIndex === i ? currentTheme.primary : `${currentTheme.primary}1a`,
                                                        color: selectedIndex === i ? '#000' : currentTheme.primary
                                                    }}
                                                >
                                                    {opt.value}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            
                            <div className="mt-6 pt-4 border-t border-emerald-900/30 flex justify-between items-end"
                                style={{ borderColor: `${currentTheme.primary}33` }}>
                                <div className="text-emerald-900 text-[11px] font-bold leading-tight uppercase"
                                    style={{ color: `${currentTheme.primary}` }}>
                                    Navigation: Mouse/Touch<br />
                                    Selection: Left Click
                                </div>
                                <div className="text-right">
                                    <span className="text-emerald-900 text-[11px] block uppercase font-mono"
                                        style={{ color: `${currentTheme.primary}` }}>Kernel Release: 1.0.4-STABLE</span>
                                    <span className="text-emerald-500 text-[11px] font-mono"
                                        style={{ color: `${currentTheme.primary}` }}>System Time: {new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    
                    {activeSubMenu === 'RENDER_QUALITY' && (
                        <div
                            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90"
                        >
                            <div
                                style={{
                                    width: '320px',
                                    backgroundColor: '#000',
                                    border: `3px solid ${currentTheme.primary}`,
                                    
                                }}
                                className="p-1 relative scale-110" 
                            >
                                
                                <div className="bg-[#10b981] text-black text-[14px] px-3 py-2 font-bold uppercase mb-2 flex justify-between items-center"
                                    style={{ backgroundColor: currentTheme.primary }}>
                                    <span style={{ filter: 'none' }}>SELECT QUALITY</span>

                                </div>

                                
                                <div className="flex flex-col gap-1.5 p-1">
                                    {[50, 100, 200, 300, 400, 600].map((val) => (
                                        <button
                                            key={val}
                                            disabled={isProcessing}
                                            onClick={() => {
                                                setSettings(prev => ({ ...prev, renderQuality: val }));
                                                if (lastFileRef.current) {
                                                    reprocessGif(lastFileRef.current, val);
                                                }
                                                
                                            }}
                                            style={{
                                                borderColor: settings.renderQuality === val ? currentTheme.primary : `${currentTheme.primary}33`,
                                                backgroundColor: settings.renderQuality === val ? currentTheme.primary : 'transparent',
                                                color: settings.renderQuality === val ? '#000' : currentTheme.primary,
                                                opacity: isProcessing ? 0.5 : 1, 
                                                cursor: isProcessing ? 'not-allowed' : 'pointer'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (settings.renderQuality !== val) {
                                                    e.currentTarget.style.backgroundColor = currentTheme.secondary;
                                                    e.currentTarget.style.borderColor = currentTheme.primary;
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (settings.renderQuality !== val) {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.borderColor = `${currentTheme.primary}33`;
                                                }
                                            }}
                                            className="w-full px-4 py-3 text-[16px] font-mono flex justify-between items-center border-2 transition-colors font-bold"
                                        >
                                            <span>{val} CHARS</span>
                                            
                                            {isProcessing && settings.renderQuality === val ? (
                                                <span className="animate-spin">◒</span>
                                            ) : (
                                                settings.renderQuality === val && <span>[X]</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setActiveSubMenu(null)}
                                    className="w-full text-center text-[#10b981] mt-2 py-2 text-[12px] hover:underline uppercase font-bold"
                                    style={{ color: currentTheme.primary }}>
                                    [ RETURN ]
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSubMenu === 'SPEED' && (
                        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90">
                            <div
                                style={{
                                    width: '320px',
                                    backgroundColor: '#000',
                                    border: `3px solid ${currentTheme.primary}`,
                                    boxShadow: `0 0 30px ${currentTheme.secondary}`
                                }}
                                className="p-1 relative scale-110"
                            >
                                <div
                                    style={{ backgroundColor: currentTheme.primary }}
                                    className="text-black text-[14px] px-3 py-2 font-bold uppercase mb-2"
                                >
                                    Select Speed
                                </div>

                                <div className="flex flex-col gap-1.5 p-1">
                                    {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                setSettings(prev => ({ ...prev, speed: s }));
                                                setActiveSubMenu(null);
                                            }}
                                            style={{
                                                borderColor: settings.renderQuality === s ? currentTheme.primary : `${currentTheme.primary}33`,
                                                backgroundColor: settings.renderQuality === s ? currentTheme.primary : 'transparent',
                                                color: settings.renderQuality === s ? '#000' : currentTheme.primary
                                            }}
                                            onMouseEnter={(e) => {
                                                if (settings.renderQuality !== s) {
                                                    e.currentTarget.style.backgroundColor = currentTheme.secondary;
                                                    e.currentTarget.style.borderColor = currentTheme.primary;
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (settings.renderQuality !== s) {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.borderColor = `${currentTheme.primary}33`;
                                                }
                                            }}
                                            className="w-full px-4 py-3 text-[16px] font-mono flex justify-between items-center border-2 transition-colors font-bold"
                                        >
                                            <span>x{s.toFixed(2)}</span>
                                            {settings.speed === s && <span>[SELECTED]</span>}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setActiveSubMenu(null)}
                                    style={{ color: currentTheme.primary }}
                                    className="w-full text-center mt-2 py-2 text-[12px] font-bold opacity-70 hover:opacity-100"
                                >
                                    [ RETURN ]
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSubMenu === 'PALETTE' && (
                        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 font-mono">
                            <div
                                style={{
                                    width: '320px', 
                                    backgroundColor: '#000',
                                    border: `3px solid ${currentTheme.primary}`,
                                    boxShadow: '0 0 50px rgba(0,0,0,1)'
                                }}
                                className="p-1 relative scale-110"
                            >
                                
                                <div
                                    style={{ backgroundColor: currentTheme.primary }}
                                    className="text-black text-[14px] px-3 py-2 font-bold uppercase mb-4 flex justify-between"
                                >
                                    <span>Color Calibration</span>
                                </div>

                                <div className="px-4 pb-2">
                                    <div className="flex flex-col gap-6 mb-6">
                                        {['r', 'g', 'b'].map((channel) => {
                                            const rgb = hexToRgb(settings.palette);
                                            const value = rgb[channel as keyof typeof rgb];

                                            return (
                                                <div key={channel} className="flex flex-col gap-2">
                                                    <div className="flex justify-between text-[14px] uppercase font-bold">
                                                        <span style={{ color: currentTheme.primary }}>Channel_{channel}</span>
                                                        <span style={{ color: currentTheme.primary }}>{value}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="255"
                                                        value={value}
                                                        onChange={(e) => {
                                                            const newValue = parseInt(e.target.value);
                                                            let newRgb = { ...rgb, [channel]: newValue };

                                                            
                                                            if (newRgb.r + newRgb.g + newRgb.b < 50) {
                                                                newRgb[channel as keyof typeof rgb] = 40;
                                                            }

                                                            setSettings(prev => ({
                                                                ...prev,
                                                                palette: rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                                                            }));
                                                        }}
                                                        className="w-full h-2 bg-neutral-900 appearance-none cursor-pointer border border-white/5"
                                                        style={{ accentColor: currentTheme.primary }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                   
                                    <div className="flex justify-between items-center py-4 border-t border-white/10">
                                        <div className="min-w-0">
                                            <div className="text-[10px] opacity-30 uppercase tracking-tighter">Hex_Output</div>
                                            <div className="text-[20px] font-black tracking-tight" style={{ color: currentTheme.primary }}>
                                                {settings.palette.toUpperCase()}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setActiveSubMenu(null)}
                                            
                                            className="px-6 py-2 text-[14px] font-bold border-2 transition-all"
                                            style={{
                                                borderColor: currentTheme.primary,
                                                color: currentTheme.primary
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = currentTheme.primary;
                                               
                                                e.currentTarget.style.color = '#000';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = currentTheme.primary;
                                            }}
                                        >
                                            [ DONE ]
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSubMenu === 'UPLOAD' && (
                        <div className="absolute inset-0 z-[300] bg-black/95 flex items-center justify-center p-4">
                            <div className="w-full max-w-md border-2 bg-black flex flex-col" style={{ borderColor: currentTheme.primary }}>
                                
                                <div style={{ backgroundColor: currentTheme.primary }} className="text-black p-3 font-bold text-center uppercase text-sm">
                                    {isProcessing ? ">>> UPLOADING_AND_CONVERTING <<<" : "File System Upload"}
                                </div>

                                <div className="p-8 flex flex-col items-center gap-6">
                                    <div
                                        className={`w-full h-32 border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${isProcessing ? 'cursor-wait' : 'cursor-pointer hover:bg-white/5'}`}
                                        style={{
                                            borderColor: isProcessing ? currentTheme.primary : `${currentTheme.primary}44`,
                                            
                                            animation: isProcessing ? 'pulse 1.5s infinite' : 'none'
                                        }}
                                        onClick={() => !isProcessing && document.getElementById('gif-upload')?.click()}
                                    >
                                        {isProcessing ? (
                                            
                                            <div className="flex flex-col items-center gap-2">
                                                <span style={{ color: currentTheme.primary }} className="text-[12px] font-black animate-pulse">
                                                    [ ENCODING_FRAMES... ]
                                                </span>
                                                <div className="w-32 h-1 bg-white/10 relative overflow-hidden">
                                                    <div
                                                        className="absolute inset-0 bg-current animate-[loading_2s_infinite]"
                                                        style={{ backgroundColor: currentTheme.primary }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                           
                                            <>
                                                <span style={{ color: currentTheme.primary }} className="text-[10px] uppercase font-black opacity-60">
                                                    Click to select .GIF
                                                </span>
                                                <span style={{ color: currentTheme.primary }} className="text-[8px] opacity-40">
                                                    (Max 120 frames recommended)
                                                </span>
                                            </>
                                        )}

                                        <input
                                            id="gif-upload"
                                            type="file"
                                            accept="image/gif"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            disabled={isProcessing}
                                        />
                                    </div>

                                    
                                    <button
                                        disabled={isProcessing}
                                        onClick={() => setActiveSubMenu(null)}
                                        className="w-full h-12 border-2 font-black text-xs transition-opacity"
                                        style={{
                                            borderColor: currentTheme.primary,
                                            color: currentTheme.primary,
                                            opacity: isProcessing ? 0.3 : 1
                                        }}
                                    >
                                        {isProcessing ? "[ PLEASE_WAIT ]" : "[ ABORT_MISSION ]"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}




                   

                    {!showSettings && (
                        <div className="flex-1 w-full h-full relative flex items-center justify-center overflow-hidden border-r border-white/5 bg-black/20">
                            <AsciiDisplay
                                frame={asciiFrames[String(settings.renderQuality)]?.[frameIndex] || ""}
                                color={currentTheme.primary}
                                quality={settings.renderQuality}
                            />
                        </div>
                    )}
                </div>

                
                <div
                    className="flex-none w-full flex items-center justify-between px-8 border-t transition-colors"
                    style={{
                        height: '90px',
                        backgroundColor: `${currentTheme.primary}05`, 
                        borderColor: `${currentTheme.primary}33`
                    }}
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsRunning(!isRunning)}
                            className="h-12 px-6 border font-mono active:scale-95 transition-all uppercase font-bold"
                            style={{
                                borderColor: `${currentTheme.primary}80`,
                                color: currentTheme.primary,
                                backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentTheme.secondary}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {isRunning ? '|| PAUSE' : '▶ EXECUTE'}
                        </button>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="w-12 h-12 border flex items-center justify-center transition-all"
                            style={{
                                borderColor: `${currentTheme.primary}80`,
                                color: currentTheme.primary
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentTheme.secondary}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                            </svg>
                        </button>
                        
                        <button
                            onClick={downloadAsciiGif}
                            disabled={isProcessing}
                            className={`w-12 h-12 border flex items-center justify-center transition-all ${isProcessing ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-white/5'
                                }`}
                            style={{
                                borderColor: isProcessing ? `${currentTheme.primary}40` : `${currentTheme.primary}80`,
                                color: currentTheme.primary,
                                backgroundColor: 'transparent'
                            }}
                        >
                            {isProcessing ? (
                                
                                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : (
                                
                                <svg
                                    width="18" height="18"
                                    viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5"
                                    strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            )}
                        </button>


                        


                    </div>

                    
                    <div className="flex items-center gap-8 font-mono">
                        <div className="text-right">
                            <div className="text-[10px] uppercase opacity-40" style={{ color: currentTheme.primary }}>System FPS</div>
                            <div className="text-2xl font-black leading-none" style={{ color: currentTheme.primary }}>{fps}</div>
                        </div>
                        
                        <div className="flex gap-1.5 h-8 items-end">
                            {[...Array(8)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 transition-all duration-200"
                                    style={{
                                        height: `${20 + Math.random() * 80}%`,
                                        backgroundColor: currentTheme.primary,
                                        opacity: 0.2 + (Math.random() * 0.4)
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

};

export default AsciiTerminal;