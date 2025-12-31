// ни conveх, ни imgbb не работают в россии, сайт без впна не открывается, я в ахуе
// картинки сохраняются в base64 на google sheets, "гениально" просто
"use client";

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    Moveable: any;
    html2canvas: any;
    interact: any;
    goToHome: (event: React.MouseEvent) => void;
  }
}

// Конфигурация
const MAX_ORNAMENTS_PER_USER = 5;
const CLEANUP_MINUTES = 10;
const UPDATE_INTERVAL = 2000; // 2 секунд

// Функция для сжатия изображения если оно больше 768KB
const compressImageIfNeeded = async (file: File): Promise<string> => {
  if (file.size <= 768 * 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }
  
  try {
    const bitmap = await createImageBitmap(file);
    
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / bitmap.width);
    canvas.width = Math.floor(bitmap.width * scale);
    canvas.height = Math.floor(bitmap.height * scale);
    
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(blob!);
        },
        'image/png',
        0.7
      );
    });
    
  } catch (error) {
    console.error('Error compressing image:', error);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }
};

// Вспомогательная функция для удаления дубликатов орнаментов
const removeDuplicateOrnaments = (ornaments: any[]): any[] => {
  const seen = new Set();
  return ornaments.filter(ornament => {
    const key = `${ornament.userId}_${ornament.x}_${ornament.y}_${ornament.src?.substring(0, 100)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export default function TreePage() {
  const communityTreeRef = useRef<HTMLDivElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const openPanelBtnRef = useRef<HTMLButtonElement>(null);
  const closePanelBtnRef = useRef<HTMLButtonElement>(null);
  const addOrnamentBtnRef = useRef<HTMLButtonElement>(null);
  const placementMessageRef = useRef<HTMLDivElement>(null);
  const panelInstructionRef = useRef<HTMLDivElement>(null);
  
  const [isPlacingOrnament, setIsPlacingOrnament] = useState(false);
  const [currentCustomImageSrc, setCurrentCustomImageSrc] = useState<string | null>(null);
  const [moveableInstance, setMoveableInstance] = useState<any>(null);
  const [currentCustomOrnament, setCurrentCustomOrnament] = useState<HTMLElement | null>(null);
  const [ornaments, setOrnaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userOrnamentCount, setUserOrnamentCount] = useState(0);
  const [userId, setUserId] = useState<string>('');
  const [totalOrnaments, setTotalOrnaments] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const userOrnamentCountRef = useRef(0);
  const userIdRef = useRef(''); // Добавляем ref для userId

  // Инициализация пользователя
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = generateUserId();
      //console.log('Generated userId:', user);
      setUserId(user);
      userIdRef.current = user; // Сохраняем в ref
      
      // Загружаем счетчик из localStorage
      const storedCount = localStorage.getItem(`userOrnamentCount_${user}`);
      if (storedCount) {
        const count = parseInt(storedCount, 10);
        setUserOrnamentCount(count);
        userOrnamentCountRef.current = count;
      }
      
      fetchOrnaments();
    }
  }, []);

  // Обновляем ref при изменении счетчика
  useEffect(() => {
    userOrnamentCountRef.current = userOrnamentCount;
    //console.log('Ref updated:', userOrnamentCount);
  }, [userOrnamentCount]);

  // Интервал для автоматического обновления
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const intervalId = setInterval(() => {
      if (!isUpdating && !isLoading && userIdRef.current) {
        fetchOrnaments(true);
      }
    }, UPDATE_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isUpdating, isLoading]);

// И проверь generateUserId:
const generateUserId = (): string => {
  if (typeof window === 'undefined') return 'anonymous';
  
  let userId = localStorage.getItem('communityTreeUserId');
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('communityTreeUserId', userId);
  }
  
  //console.log('Generated/Retrieved userId:', userId);
  return userId;
};

  const initCommunityTree = () => {
    if (!communityTreeRef.current || !window.Moveable) return;

    const moveable = new window.Moveable(communityTreeRef.current, {
      target: null,
      draggable: true,
      resizable: true,
      rotatable: true,
      keepRatio: true,
      renderDirections: ["nw", "ne", "sw", "se"]
    });

    moveable.on("drag", (e: any) => {
      if (e.target && e.target.classList.contains('editing')) {
        e.target.style.transform = e.transform;
        /*const controlsContainer = e.target.querySelector('.ornament-controls-container');
        if (controlsContainer) {
          controlsContainer.style.transform = e.transform;
        }*/
      }
    });

    moveable.on("resize", (e: any) => {
      if (e.target && e.target.classList.contains('editing')) {
        e.target.style.width = `${e.width}px`;
        e.target.style.height = `${e.height}px`;
        e.target.style.transform = e.transform;
        /*const controlsContainer = e.target.querySelector('.ornament-controls-container');
        if (controlsContainer) {
          controlsContainer.style.transform = e.transform;
        }*/
      }
    });

    /*moveable.on("rotate", (e: any) => {
      if (e.target && e.target.classList.contains('editing')) {
        e.target.style.transform = e.transform;
        const controlsContainer = e.target.querySelector('.ornament-controls-container');
        if (controlsContainer) {
          controlsContainer.style.transform = e.transform;
        }
      }
    });*/

    setMoveableInstance(moveable);
  };

// Загрузка орнаментов с сервера
const fetchOrnaments = async (silent = false) => {
  try {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsUpdating(true);
    }

    const currentUserId = userIdRef.current;
    
    // Получаем орнаменты вместе с количеством для текущего пользователя
    const response = await fetch(`/api/ornaments?userId=${encodeURIComponent(currentUserId)}&t=${Date.now()}`);
    const data = await response.json();
    
    if (!data.ornaments || !Array.isArray(data.ornaments)) {
      return;
    }
    
    // Удаляем дубликаты
    const uniqueOrnaments = removeDuplicateOrnaments(data.ornaments);
    
    // Проверяем, изменились ли орнаменты
    const hasChanges = JSON.stringify(uniqueOrnaments) !== JSON.stringify(ornaments);
    
    if (hasChanges && communityTreeRef.current) {
      // Очищаем только fixed орнаменты
      const existing = communityTreeRef.current.querySelectorAll('.ornament.fixed:not(.editing)');
      existing.forEach(el => el.remove());
      
      // Добавляем новые
      uniqueOrnaments.forEach(createOrnamentFromData);
      setOrnaments(uniqueOrnaments);
      setTotalOrnaments(uniqueOrnaments.length);
      setLastUpdateTime(Date.now());

      const userCount = uniqueOrnaments.filter(
        o => o.userId === currentUserId
      ).length;

      setUserOrnamentCount(userCount);
      userOrnamentCountRef.current = userCount;
      localStorage.setItem(
        `userOrnamentCount_${currentUserId}`,
        userCount.toString()
      );
    }
  } catch (error) {
    console.error('Error fetching ornaments:', error);
    if (!silent) {
      setError('Failed to load ornaments from server');
    }
  } finally {
    if (!silent) {
      setIsLoading(false);
    } else {
      setIsUpdating(false);
    }
  }
};

  // Создание орнамента из данных сервера
  const createOrnamentFromData = (ornamentData: any) => {
    if (!communityTreeRef.current) return;
    
    // Проверяем, не существует ли уже такой орнамент
    const existingId = `${ornamentData.userId}_${ornamentData.x}_${ornamentData.y}_${ornamentData.src?.substring(0, 100)}`;
    const existing = communityTreeRef.current.querySelector(`[data-ornament-id="${existingId}"]`);
    if (existing) return;
    
    const ornament = document.createElement('div');
    ornament.className = 'ornament fixed';
    ornament.setAttribute('data-ornament-id', existingId);
    ornament.style.position = 'absolute';
    ornament.style.left = ornamentData.x || '0px';
    ornament.style.top = ornamentData.y || '0px';
    ornament.style.width = ornamentData.width || '120px';
    ornament.style.height = ornamentData.height || '120px';
    ornament.style.transform = ornamentData.transform || '';
    
    const imgContainer = document.createElement('div');
    imgContainer.className = 'ornament-image-container';
    
    const img = document.createElement('img');
    
    if (ornamentData.src && ornamentData.src.startsWith('data:')) {
      img.src = ornamentData.src;
    }
    
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    
    imgContainer.appendChild(img);
    ornament.appendChild(imgContainer);
    communityTreeRef.current.appendChild(ornament);
    
    // Анимация появления
    ornament.style.opacity = '0';
    ornament.style.transform += ' scale(0.8)';
    
    setTimeout(() => {
      ornament.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      ornament.style.opacity = '1';
      ornament.style.transform = ornament.style.transform.replace(' scale(0.8)', '');
    }, 10);
    
    // Подсветка при клике
    ornament.onclick = () => {
      ornament.style.boxShadow = '0 0 0 3px rgba(197, 164, 126, 0.3)';
      setTimeout(() => {
        ornament.style.boxShadow = '';
      }, 1000);
    };
  };

  const openFloatingPanel = () => {
    if (floatingPanelRef.current && openPanelBtnRef.current) {
      floatingPanelRef.current.style.display = 'block';
      setTimeout(() => {
        floatingPanelRef.current?.classList.add('active');
      }, 10);
      openPanelBtnRef.current.style.display = 'none';
      
      if (currentCustomOrnament) {
        currentCustomOrnament.remove();
        setCurrentCustomOrnament(null);
        if (moveableInstance) moveableInstance.target = null;
      }
    }
  };

  const closeFloatingPanel = () => {
    if (floatingPanelRef.current && openPanelBtnRef.current) {
      floatingPanelRef.current.classList.remove('active');
      setTimeout(() => {
        floatingPanelRef.current!.style.display = 'none';
        openPanelBtnRef.current!.style.display = 'flex';
      }, 300);
      cancelOrnamentPlacement();
    }
  };

  // Обработчик клика на добавление орнамента
  const handleAddOrnamentClick = () => {
    // Проверяем загружены ли орнаменты
const currentCount = userOrnamentCountRef.current;
    //console.log('Current count from ref:', currentCount);
    if (isLoading) {
      showErrorMessage("Please wait while ornaments are loading...");
      return;
    }
    
    if (userOrnamentCount >= MAX_ORNAMENTS_PER_USER) {
      showErrorMessage(`You already have ${MAX_ORNAMENTS_PER_USER} ornaments.`);
      return;
    }
    
    cancelOrnamentPlacement();
  
    
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.style.display = 'none';
    
    tempInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      try {
        if (panelInstructionRef.current) {
          panelInstructionRef.current.innerHTML = '<p>Compressing image...</p>';
        }

        const compressedImageData = await compressImageIfNeeded(file);
        
        setCurrentCustomImageSrc(compressedImageData);
        setIsPlacingOrnament(true);
        
        if (placementMessageRef.current && panelInstructionRef.current && communityTreeRef.current) {
          placementMessageRef.current.style.display = 'block';
          panelInstructionRef.current.innerHTML = '<p>Click "Add Ornament" and select an image file to add to the community tree</p>';
          panelInstructionRef.current.style.display = 'none';
          communityTreeRef.current.style.cursor = 'crosshair';
          placementMessageRef.current.textContent = 'Click anywhere on the community tree to place your ornament';
        }
      } catch (error) {
        console.error('Error processing image:', error);
        showErrorMessage('Failed to process image. Please try another image.');
        
        if (panelInstructionRef.current) {
          panelInstructionRef.current.innerHTML = '<p>Click "Add Ornament" and select an image file to add to the community tree</p>';
        }
      }
    };
    
    document.body.appendChild(tempInput);
    tempInput.click();
    setTimeout(() => {
      document.body.removeChild(tempInput);
    }, 100);

        //console.log(userOrnamentCount);

  };

const cancelOrnamentPlacement = () => {
    setIsPlacingOrnament(false);
    
    // Удаляем элементы управления Moveable
    const moveableElements = document.querySelectorAll('.moveable-control, .moveable-line, .moveable-rotation');
    moveableElements.forEach(el => el.remove());
    
    if (placementMessageRef.current && panelInstructionRef.current && communityTreeRef.current) {
        placementMessageRef.current.style.display = 'none';
        panelInstructionRef.current.style.display = 'block';
        communityTreeRef.current.style.cursor = 'default';
        
        if (currentCustomOrnament) {
            currentCustomOrnament.remove();
            setCurrentCustomOrnament(null);
            if (moveableInstance) {
                moveableInstance.target = null;
                moveableInstance.destroy();
                setMoveableInstance(null);
            }
        }
    }
};

  const handleTreeClick = (e: React.MouseEvent) => {
    if (!isPlacingOrnament || !currentCustomImageSrc || !communityTreeRef.current) return;
    
    const rect = communityTreeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
    
    createCustomOrnament(x, y);
    
    setIsPlacingOrnament(false);
    if (placementMessageRef.current && communityTreeRef.current) {
      placementMessageRef.current.style.display = 'none';
      communityTreeRef.current.style.cursor = 'default';
    }
  };

const createCustomOrnament = (x: number, y: number) => {
  if (!communityTreeRef.current || !window.Moveable) return;
  
  // Уничтожаем предыдущий Moveable если есть
  const oldMoveableElements = document.querySelectorAll('.moveable-control, .moveable-line, .moveable-rotation');
  oldMoveableElements.forEach(el => el.remove());
  
  // Уничтожаем предыдущий Moveable если есть
  if (moveableInstance) {
    moveableInstance.destroy();
  }
  
  // Создаем орнамент
  const ornament = document.createElement('div');
  ornament.className = 'ornament editing';
  const ornamentId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  ornament.setAttribute('data-ornament-id', ornamentId);
  
  const imgContainer = document.createElement('div');
  imgContainer.className = 'ornament-image-container';
  
  const img = document.createElement('img');
  img.src = currentCustomImageSrc!;
  img.crossOrigin = 'anonymous';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  
  imgContainer.appendChild(img);
  ornament.appendChild(imgContainer);
  
  ornament.style.position = 'absolute';
  ornament.style.left = `${x - 60}px`;
  ornament.style.top = `${y - 60}px`;
  ornament.style.width = '120px';
  ornament.style.height = '120px';
  ornament.style.border = '2px dashed #c5a47e';
  ornament.style.borderRadius = '50%';
  
  communityTreeRef.current.appendChild(ornament);
  setCurrentCustomOrnament(ornament);
  
  // Создаем контейнер для кнопок управления
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'ornament-controls-container';
  controlsContainer.setAttribute('data-ornament-id', ornamentId);
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-control btn-save';
  saveBtn.innerHTML = '<i class="fas fa-check">✓</i>';
  saveBtn.title = 'Save ornament';
  saveBtn.onclick = (e) => {
    e.stopPropagation();
    saveOrnament(ornament);
  };
  saveBtn.style.position = 'absolute';
  saveBtn.style.top = '-14px';
  saveBtn.style.left = '110%';
  saveBtn.style.zIndex = '1001';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-control btn-delete';
  deleteBtn.innerHTML = '<i class="fas fa-times">×</i>';
  deleteBtn.title = 'Delete ornament';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteOrnament(ornament);
  };
  deleteBtn.style.position = 'absolute';
  deleteBtn.style.top = '-14px';
  deleteBtn.style.right = '110%' // Сдвигаем влево от кнопки сохранения
  deleteBtn.style.zIndex = '1001';
  
  ornament.appendChild(saveBtn);
  ornament.appendChild(deleteBtn);
  
  const moveable = new window.Moveable(communityTreeRef.current, {
    target: ornament,
    draggable: true,
    resizable: true,
    rotatable: true,
    keepRatio: true,
    renderDirections: ["nw", "ne", "sw", "se"],
  });

  const handleDrag = (e: any) => {
    if (e.target === ornament) {
      e.target.style.transform = e.transform;
    }
  };

  const MAX_SIZE = 150; //максимальный размер на сторону
  const handleResize = (e: any) => {
    if (e.target !== ornament) return;

    const width = Math.min(e.width, MAX_SIZE);
    const height = Math.min(e.height, MAX_SIZE);

    ornament.style.width = `${width}px`;
    ornament.style.height = `${height}px`;
    ornament.style.transform = e.transform;
  };


  const handleRotate = (e: any) => {
    if (e.target === ornament) {
      e.target.style.transform = e.transform;
    }
  };

  moveable.on("drag", handleDrag);
  moveable.on("resize", handleResize);
  moveable.on("rotate", handleRotate);
  
  setMoveableInstance(moveable);
  
  ornament.onmousedown = (e) => {
    e.stopPropagation();
    moveable.target = ornament;
  };
};

  const compressImageToBase64 = async (base64Image: string, maxWidth: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressedBase64);
      };
      
      img.onerror = () => {
        resolve(base64Image);
      };
      
      img.src = base64Image;
    });
  };

// Сохранение орнамента на сервер
const saveOrnament = async (ornament: HTMLElement) => {
    if (!ornament || !userId || !communityTreeRef.current) return;
    setIsLoading(true);
    
    // ПРОВЕРКА ЛИМИТА
    if (userOrnamentCount >= MAX_ORNAMENTS_PER_USER) {
        showErrorMessage(`You already have ${MAX_ORNAMENTS_PER_USER} ornaments.`);
        return;
    }
    
    setError(null);
    
    // Удаляем controlsContainer
    const ornamentId = ornament.getAttribute('data-ornament-id');
    const controlsContainer = communityTreeRef.current.querySelector(`.ornament-controls-container[data-ornament-id="${ornamentId}"]`);
    if (controlsContainer) {
        controlsContainer.remove();
    }
    
    // Убираем границы и класс editing
    ornament.classList.remove('editing');
    ornament.style.border = 'none';
    ornament.style.cursor = 'default';
    ornament.onmousedown = null;
    
    const imgSrc = ornament.querySelector('img')?.src;
    if (!imgSrc) return;
    
    try {
        let imageUrl = imgSrc;
        
        if (imgSrc.length > 40000) {
            const compressed = await compressImageToBase64(imgSrc, 300);
            imageUrl = compressed;
        }
        
        const ornamentData = {
            action: 'saveOrnament',
            userId: userId,
            src: imageUrl,
            x: ornament.style.left,
            y: ornament.style.top,
            width: ornament.style.width,
            height: ornament.style.height,
            transform: ornament.style.transform || '',
            timestamp: Date.now(),
            storageType: 'base64'
        };
        
        const response = await fetch('/api/ornaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ornamentData),
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        if (typeof data.userCount === 'number') {
          setUserOrnamentCount(data.userCount);
          userOrnamentCountRef.current = data.userCount;
          localStorage.setItem(
            `userOrnamentCount_${userId}`,
            data.userCount.toString()
          );
        }
        
        // удаление поля редактирования
        const moveableElements = document.querySelectorAll('.moveable-control, .moveable-line, .moveable-rotation, .moveable-control-box');
        moveableElements.forEach(el => el.remove());
        
        // Уничтожаем Moveable
        /*if (moveableInstance) {
            moveableInstance.destroy();
            setMoveableInstance(null);
        }*/
        
        ornament.remove();
        setCurrentCustomOrnament(null);
        
        //await fetchOrnaments();
        
        //console.log(`✓ Ornament saved! You have ${data.userCount || (userOrnamentCount + 1)}/${MAX_ORNAMENTS_PER_USER} ornaments`);
        setUserOrnamentCount(data.userCount);
        
    } catch (error: any) {
        console.error('Error saving ornament:', error);
        
        let errorMessage = error.message || 'Failed to save ornament';
        if (error.message.includes('Maximum')) {
            errorMessage = error.message;
        }
        
        showErrorMessage(errorMessage);
        setError(errorMessage);
        
        // Восстанавливаем controlsContainer если ошибка
        if (controlsContainer && communityTreeRef.current) {
            communityTreeRef.current.appendChild(controlsContainer);
            ornament.classList.add('editing');
            ornament.style.border = '2px dashed #c5a47e';
        }
    } finally {
        setIsLoading(false);
    }
};

  // Удаление орнамента
const deleteOrnament = async (ornament: HTMLElement) => {
    if (!ornament || !communityTreeRef.current) return;
    
    try {
        const ornamentId = ornament.getAttribute('data-ornament-id');
        
        // Если это сохраненный орнамент, удаляем с сервера
        if (ornamentId && !ornamentId.startsWith('local_')) {
            const response = await fetch(`/api/ornaments?ornamentId=${encodeURIComponent(ornamentId)}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete ornament from server');
            }
        }
        
        // Удаляем controlsContainer
        if (ornamentId) {
            const controlsContainer = communityTreeRef.current.querySelector(`.ornament-controls-container[data-ornament-id="${ornamentId}"]`);
            if (controlsContainer) {
                controlsContainer.remove();
            }
        }
        
        // Уничтожаем Moveable если это редактируемый орнамент
        if (ornament.classList.contains('editing')) {
            try {
                // Удаляем все элементы управления Moveable из DOM
                const moveableElements = document.querySelectorAll('.moveable-control, .moveable-line, .moveable-rotation');
                moveableElements.forEach(el => el.remove());
                
                // Безопасное уничтожение Moveable
                if (moveableInstance && typeof moveableInstance.destroy === 'function') {
                    // Проверяем, что moveableInstance все еще валиден
                    if (moveableInstance.target === ornament) {
                        moveableInstance.target = null;
                    }
                    moveableInstance.destroy();
                }
            } catch (error) {
                console.warn('Error destroying moveable instance:', error);
            } finally {
                setMoveableInstance(null);
            }
        }
        
        // Удаляем орнамент
        ornament.remove();
        setCurrentCustomOrnament(null);
        
        // Обновляем список орнаментов
        //await fetchOrnaments();
        
        //showSuccessMessage('Ornament deleted');
    } catch (error) {
        console.error('Error deleting ornament:', error);
        showErrorMessage('Failed to delete ornament');
    }
};

  const showSuccessMessage = (message: string) => {
    if (!panelInstructionRef.current) return;
    
    const originalHTML = panelInstructionRef.current.innerHTML;
    panelInstructionRef.current.innerHTML = `<p style="color:#4CAF50;">${message}</p>`;
    panelInstructionRef.current.style.display = 'block';
    
    setTimeout(() => {
      if (panelInstructionRef.current) {
        panelInstructionRef.current.innerHTML = originalHTML;
      }
    }, 2000);
  };

  const showErrorMessage = (message: string) => {
    if (!panelInstructionRef.current) return;
    
    const originalHTML = panelInstructionRef.current.innerHTML;
    panelInstructionRef.current.innerHTML = `<p style="color:#f44336;">${message}</p>`;
    panelInstructionRef.current.style.display = 'block';
    
    setTimeout(() => {
      if (panelInstructionRef.current) {
        panelInstructionRef.current.innerHTML = originalHTML;
      }
    }, 3000);
  };

  const goToHome = (event: React.MouseEvent) => {
    event.preventDefault();
    window.location.href = '/';
  };

  // Ручное обновление орнаментов
  /*const handleManualRefresh = async () => {
    await fetchOrnaments();
    showSuccessMessage('✓ Ornaments updated');
  };*/

  return (
    <>
      <Script src="https://daybrush.com/moveable/release/latest/dist/moveable.min.js" strategy="beforeInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js" strategy="beforeInteractive" />

      <header className="navbar">
        <div className="nav-container">
          <div className="logo">
            <a href="/" id="mainBtn" className="logo-link" onClick={goToHome}>
              <i className="fas fa-home"></i>
              <span>Trenchmass</span>
            </a>
          </div>
          <nav className="nav-menu">
            <a href="tree" className="nav-link" id="tasksBtn">
              <i className="fas fa-users"></i>
              <span>Community tree</span>
            </a>
            <a href="/#tree-creator" className="nav-link" id="notesBtn">
              <i className="fas fa-wand-magic-sparkles"></i>
              <span>Tree builder</span>
            </a>
            <a href="/#socials" className="nav-link" id="calendarBtn">
              <i className="fas fa-share-nodes"></i>
              <span>Socials</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Плавающая панель для добавления шариков */}
      <div className="floating-panel" id="floatingPanel" ref={floatingPanelRef}>
        <div className="panel-header">
          <span>Add to Community Tree</span>
          <button className="close-panel-btn" id="closePanelBtn" ref={closePanelBtnRef} onClick={closeFloatingPanel}>
            &times;
          </button>
        </div>
        <div className="panel-content">
          <div className="panel-instruction" id="panelInstruction" ref={panelInstructionRef}>
            <p>Click "Add Ornament" and select an image file to add to the community tree</p>
            <p style={{fontSize: '12px', color: '#c5a47e', marginTop: '8px'}}>
              Images larger than 768KB will be compressed automatically. 
              You have {userOrnamentCount}/{MAX_ORNAMENTS_PER_USER} ornaments.
            </p>
            <p style={{fontSize: '11px', color: '#888', marginTop: '4px'}}>
              Ornaments are automatically removed every {CLEANUP_MINUTES} minutes
            </p>
          </div>
          
          {isLoading && (
            <div style={{textAlign: 'center', padding: '10px'}}>
              <div className="loading-spinner"></div>
              <p style={{fontSize: '12px', color: '#c5a47e', marginTop: '5px'}}>Loading...</p>
            </div>
          )}
          
          {error && (
            <div style={{color: '#f44336', padding: '10px', textAlign: 'center', fontSize: '14px'}}>
              {error}
            </div>
          )}
          
<button 
  className="btn-add-ornament" 
  id="addOrnamentBtn" 
  ref={addOrnamentBtnRef} 
  onClick={handleAddOrnamentClick}
  disabled={isLoading || userOrnamentCount >= MAX_ORNAMENTS_PER_USER}
  style={{
    opacity: (isLoading || userOrnamentCount >= MAX_ORNAMENTS_PER_USER) ? 0.6 : 1,
    cursor: (isLoading || userOrnamentCount >= MAX_ORNAMENTS_PER_USER) ? 'not-allowed' : 'pointer'
  }}
>
  <span>+</span>
  <span>
    {isLoading ? 'Loading...' : 
     userOrnamentCount >= MAX_ORNAMENTS_PER_USER 
        ? 'Limit Reached (5/5)' 
        : 'Add Ornament'
    }
  </span>
</button>
          
          <div className="placement-message" id="placementMessage" ref={placementMessageRef} style={{ display: 'none' }}>
            <p>Click anywhere on the community tree to place your ornament</p>
          </div>
          
          <div className="ornament-controls" id="ornamentControls" style={{ display: 'none' }}>
            <button className="btn-control btn-save" id="saveOrnamentBtn" style={{ display: 'none' }}>
              <i className="fas fa-check"></i>
              <span>Save to Community Tree</span>
            </button>
            <button className="btn-control btn-delete" id="deleteOrnamentBtn" style={{ display: 'none' }}>
              <i className="fas fa-times"></i>
              <span>Delete Ornament</span>
            </button>
          </div>
          
          <div className="panel-footer">
            <p>Your ornament will be visible to everyone in the community</p>
            <p style={{fontSize: '10px', color: '#888', marginTop: '5px'}}>
              User ID: {userId.substring(0, 8)}...
            </p>
            <p style={{fontSize: '10px', color: '#666', marginTop: '3px'}}>
              Auto-update: Every 5 seconds
            </p>
          </div>
        </div>
      </div>

      {/*<button className="open-panel-btn" id="openPanelBtn" ref={openPanelBtnRef} onClick={openFloatingPanel}>
        <i className="fas fa-plus"></i>
        <span>Add to Tree</span>
      </button>*/}

      <main style={{ padding: '80px 20px', color: '#fafafa', fontFamily: "'Rosarivo', serif" }}>
        <h1 className="header2 center">Community tree</h1>
        <p style={{ textAlign: 'center', fontSize: '20px', marginBottom: '40px', color: '#c5a47e' }}>
          Add your ornament to our shared Christmas tree! Click the "Add to Tree" button on the right.
        </p>
        
        {/* Статусная информация */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: 'rgba(197, 164, 126, 0.1)',
          borderRadius: '8px',
          maxWidth: '600px',
          margin: '0 auto 30px',
          position: 'relative'
        }}>
          {/*<button 
            onClick={handleManualRefresh}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'transparent',
              border: '1px solid #c5a47e',
              color: '#c5a47e',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Refresh ornaments"
            disabled={isLoading || isUpdating}
          >
            <i className={`fas fa-sync ${isUpdating ? 'fa-spin' : ''}`}></i>
            Refresh
          </button>*/}
          
          <p style={{margin: '5px 0', fontSize: '14px'}}>
            <i className="fas fa-user" style={{marginRight: '8px'}}></i>
            {/*Your ornaments: <strong>{userOrnamentCount}/{MAX_ORNAMENTS_PER_USER}</strong>*/}
            You can place <strong>5</strong> ornaments
          </p>
          <p style={{margin: '5px 0', fontSize: '14px'}}>
            <i className="fas fa-clock" style={{marginRight: '8px'}}></i>
            Auto-cleanup: <strong>Every {CLEANUP_MINUTES} minutes</strong>
          </p>
          <p style={{margin: '5px 0', fontSize: '12px', color: '#888'}}>
            <i className="fas fa-tree" style={{marginRight: '8px'}}></i>
            Total ornaments on tree: <strong>{totalOrnaments}</strong>
          </p>
          <p style={{margin: '5px 0', fontSize: '11px', color: '#666'}}>
            <i className="fas fa-sync" style={{marginRight: '8px'}}></i>
            {/*Real-time updates: <strong>Active</strong> (last: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'})*/}
          </p>
          
<button 
  onClick={handleAddOrnamentClick}
  style={{
    marginTop: '10px',
    background: 'transparent',
    border: '2px dashed #c5a47e',
    color: '#c5a47e',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: (isLoading || userOrnamentCount >= MAX_ORNAMENTS_PER_USER) ? 'not-allowed' : 'pointer',
    opacity: (isLoading || userOrnamentCount >= MAX_ORNAMENTS_PER_USER) ? 0.6 : 1,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%'
  }}
  disabled={isLoading || userOrnamentCount >= MAX_ORNAMENTS_PER_USER}
>
  <i className="fas fa-plus"></i>
  {isLoading ? 'Loading...' : 
   userOrnamentCount >= MAX_ORNAMENTS_PER_USER ? 'Limit Reached' : 'Add New Ornament'}
</button>
        </div>

        <div className="community-workspace">
          <div 
            id="communityTree" 
            className="community-tree" 
            ref={communityTreeRef}
            style={{ backgroundImage: "url('/images/Group 152.png')" }}
            onClick={handleTreeClick}
          >
            {isLoading && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '4px soldi #c5a47e',
                textAlign: 'center'
              }}>
                <div className='background-spinner' style={{
                  backgroundColor: 'rgba(32, 29, 36, 0.9)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  width: '200px',
                  height: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  border: '5px solid #c5a47e',
                  borderWidth: '1px',
                  borderRadius: '20px'
                   }}>
                <div className="loading-spinner" style={{margin: '0 auto 10px'}}></div>
                <p>Loading ornaments...</p>
              </div>
              </div>
            )}
            
            {isUpdating && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                background: 'rgba(20, 20, 24, 0.8)',
                padding: '5px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#c5a47e',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: '1px solid rgba(197, 164, 126, 0.3)'
              }}>
                <i className="fas fa-sync fa-spin"></i>
                Updating...
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(197, 164, 126, 0.2);
          border-top: 4px solid #c5a47e;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .fa-spin {
          animation: fa-spin 1s linear infinite;
        }
        
        @keyframes fa-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}