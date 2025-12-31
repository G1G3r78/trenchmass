// app/page.tsx
"use client";

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Head from 'next/head';

declare global {
  interface Window {
    Moveable: any;
    html2canvas: any;
    interact: any;
    downloadTree: () => Promise<void>;
    shareOnTwitter: () => void;
    scrollToSection: (sectionId: string, event: React.MouseEvent) => void;
    goToHome: (event: React.MouseEvent) => void;
  }
}

const myOrnaments = [
  '/images/toy1.png', '/images/toy2(old).png', '/images/toy3.png', '/images/toy4.png',
  '/images/toy5.png', '/images/toy6.png', '/images/toy7.png', '/images/toy8.png',
  '/images/toy9.png', '/images/toy10.png', '/images/toy11.png', '/images/toy12.png',
  '/images/toy13.png', 'images/toy14.png', '/images/toy15.png'
];

export default function Home() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const toyInputRef = useRef<HTMLInputElement>(null);
  const moveableRef = useRef<any>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initTreeBuilder();
    }
  }, []);

  const initTreeBuilder = () => {
    if (!workspaceRef.current || !window.Moveable) return;

    moveableRef.current = new window.Moveable(workspaceRef.current, {
      target: null,
      draggable: true,
      resizable: true,
      rotatable: true,
      keepRatio: true,
      renderDirections: ["nw", "ne", "sw", "se"]
    });

    moveableRef.current.on("drag", (e: any) => {
      if (e.target) e.target.style.transform = e.transform;
    });

    moveableRef.current.on("resize", (e: any) => {
      if (e.target) {
        e.target.style.width = `${e.width}px`;
        e.target.style.height = `${e.height}px`;
        e.target.style.transform = e.transform;
      }
    });

    moveableRef.current.on("rotate", (e: any) => {
      if (e.target) e.target.style.transform = e.transform;
    });

    renderInventory();
  };

  const renderInventory = () => {
    if (!inventoryRef.current) return;
    
    inventoryRef.current.innerHTML = '';
    

    myOrnaments.forEach(src => {
      const slot = document.createElement('div');
      slot.className = 'item-slot';
      slot.innerHTML = `<img src="${src}">`;
      slot.onclick = () => addOrnament(src, false);
      inventoryRef.current?.appendChild(slot);
    });


    const plusSlot = document.createElement('div');
    plusSlot.className = 'item-slot';
    plusSlot.innerHTML = '<span>+</span>';
    plusSlot.onclick = () => toyInputRef.current?.click();
    inventoryRef.current?.appendChild(plusSlot);
  };

  const addOrnament = (src: string, isCustom: boolean) => {
    if (!workspaceRef.current) return;

    const ornament = document.createElement('div');
    ornament.className = isCustom ? 'ornament custom-ball' : 'ornament';
    
    const img = document.createElement('img');
    img.src = src;
    
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    
    ornament.appendChild(img);
    ornament.style.width = "100px";
    ornament.style.left = "250px";
    ornament.style.height = "100px";
    ornament.style.top = "250px";
    
    workspaceRef.current.appendChild(ornament);

    ornament.onmousedown = (e) => {
      e.stopPropagation();
      setSelectedElement(ornament);
      moveableRef.current.target = ornament;
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        addOrnament(ev.target.result as string, true);
      }
    };
    reader.readAsDataURL(file);
    
    if (toyInputRef.current) {
      toyInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement && moveableRef.current) {
        moveableRef.current.target = null;
        selectedElement.remove();
        setSelectedElement(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement]);

  const downloadTree = async () => {
    const ws = workspaceRef.current;
    if (!ws || !window.html2canvas) return;

    const controls = document.querySelector('.moveable-control-box');
    if (controls) (controls as HTMLElement).style.display = 'none';

    const allImages = ws.querySelectorAll('.ornament img');
    const imagePromises = Array.from(allImages).map(img => {
      return new Promise((resolve, reject) => {
        if ((img as HTMLImageElement).complete) {
          resolve(null);
        }
      });
    });

    try {
      await Promise.all(imagePromises);
      
      const canvas = await window.html2canvas(ws, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        scale: 2,
        imageTimeout: 0,
        onclone: (clonedDoc: Document) => {
          const clonedWorkspace = clonedDoc.getElementById('workspace');
          if (!clonedWorkspace) return;
          
          const ornaments = clonedWorkspace.querySelectorAll('.ornament');
          ornaments.forEach((ornament, index) => {
            const img = ornament.querySelector('img');
            if (img) {
              img.setAttribute('style', 
                'display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;'
              );
              
              if (img.getAttribute('src')?.startsWith('data:')) {
                const originalImg = allImages[index] as HTMLImageElement;
                if (originalImg?.src) {
                  img.setAttribute('src', originalImg.src);
                }
              }
            }
          });
        }
      });
      
      const link = document.createElement('a');
      link.download = 'my-trenchmass-tree.png';
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      if (controls) (controls as HTMLElement).style.display = 'block';
    } catch (err) {
      console.error("screenshot error", err);
      if (controls) (controls as HTMLElement).style.display = 'block';
    }
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent("Look at my $trenchmass tree!");
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const scrollToSection = (sectionId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const goToHome = (event: React.MouseEvent) => {
    const path = window.location.pathname;
    const isIndex = path === '/' || path.endsWith('/');
    if (!isIndex) return;

    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Trench year tree</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Rosarivo&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="stylesheet" href="/css/styles.css" />
        <link rel="shortcut icon" href="viperr.png" type="image/png" />
      </Head>

      <Script src="https://daybrush.com/moveable/release/latest/dist/moveable.min.js" strategy="beforeInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js" strategy="beforeInteractive" />

      <header className="navbar">
        <div className="nav-container">
          <div className="logo">
            <a href="/" id="mainBtn" className="logo-link" onClick={goToHome}>
              <i className="fas fa-home"></i>
              <span>Trench year tree</span>
            </a>
          </div>
          <nav className="nav-menu">
            <a href="tree" className="nav-link" id="tasksBtn">
              <i className="fas fa-users"></i>
              <span>Community tree</span>
            </a>
            <a href="#tree-creator" className="nav-link" id="notesBtn" onClick={(e) => scrollToSection('tree-creator', e)}>
              <i className="fas fa-wand-magic-sparkles"></i>
              <span>Tree builder</span>
            </a>
            <a href="#socials" className="nav-link" id="calendarBtn" onClick={(e) => scrollToSection('socials', e)}>
              <i className="fas fa-share-nodes"></i>
              <span>Socials</span>
            </a>
          </nav>
        </div>
      </header>
      
      <div className="pageone" id="home">
        <h1 className="header">Trench year tree</h1>
        <h2 className="desc">
          Help us decorate the community tree or jump into the<br/>
          studio to build your personal Christmas tree. Pick your<br/>
          favorite ornaments, add some lights and share it to our community<br/>
        </h2>
      </div>
      
      <section className="headerp2"><h1 className="header">Tree galery</h1></section>
      
      <div className="pagetwo">
        <h2 className="desc2">Happy trench year! Create a custom<br/>
          tree and share it in X community.<br/>
          And don't forget to participate in<br/>
          decorating the community tree.
        </h2>
        <img src="/images/page2.png" className="page2img" />
      </div>
      
      <section><img src="/images/xmas.png" className="xmas" /></section>
      
      <div className="pagethree section-anchor" id="tree-creator">
        <div className="editor-container">
          <h1 className="header2">Tree Creator</h1>
          <div className="main-layout">
            <div className="workspace-wrapper">
              <div 
                className="workspace" 
                id="workspace" 
                ref={workspaceRef}
                style={{ backgroundImage: "url('/images/basictree.png')" }}
              >
                <input 
                  type="file" 
                  id="toyInput" 
                  ref={toyInputRef}
                  hidden 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div className="sidebar">
              <div className="inventory" id="inventory" ref={inventoryRef}></div>
              <div className="action-buttons">
                <button className="btn-ui" onClick={downloadTree}>Download Image</button>
                <button className="btn-ui" onClick={shareOnTwitter}>Share in X</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="section-anchor" id="socials">
        <div style={{ position: 'relative' }}>
          <img src="/images/snow.png" style={{ width: '100%' }} />
          
          <div id="copyNotify" style={{
            position: 'fixed',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#4CAF50',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '6px',
            transition: 'top 0.3s',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            Copied!
          </div>

          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            gap: '20px',
            alignItems: 'center'
          }}>
            <button
              style={{
                background: 'rgba(255,255,255,0.85)',
                border: '2px solid #c5a47e',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#000',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText('Текст для копирования');
                  const notif = document.getElementById('copyNotify');
                  if (notif) {
                    notif.style.top = '20px';
                    setTimeout(() => notif.style.top = '-50px', 1500);
                  }
                } catch {}
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <i className="fas fa-copy"></i>
              Copy ca {<img src='/images/dexscreener.png' style={{width: '28px', height: '28px'}}></img>}
            </button>

            <a 
              href="/"
              style={{
                background: 'rgba(197,164,126,0.85)',
                border: '2px solid #c5a47e',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '16px',
                textDecoration: 'none',
                color: '#000',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <i className="fas fa-external-link-alt"></i>
              X community {<img src='/images/xcom.png' style={{width: '28px', height: '28px'}}></img>}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}