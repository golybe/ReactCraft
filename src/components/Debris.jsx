import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBlockTextureInfo, getBlockTexture } from '../utils/textures';
import { BLOCK_TINTS } from '../constants/colors';

const PARTICLE_COUNT = 16; // Количество осколков
const GRAVITY = 20;

const Debris = ({ x, y, z, blockType, lightLevel = 15 }) => {
    const groupRef = useRef();
    const particles = useRef([]);
    const textureRef = useRef(null);

    // Инициализация частиц один раз
    useEffect(() => {
        if (!groupRef.current) return;

        // Определяем текстуру
        const info = getBlockTextureInfo(blockType);
        // Берем текстуру: приоритет side -> all -> top
        let texName = info.side || info.all || info.top || 'dirt';
        // Если это трава, берем 'grassSide' (там оверлей), лучше взять 'grassTop' чтобы было зелено
        if (texName === 'grassSide') texName = 'grassTop'; 

        const url = getBlockTexture(texName);
        
        // Загружаем текстуру
        const loader = new THREE.TextureLoader();
        const tex = loader.load(url);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        
        textureRef.current = tex;

        const tint = BLOCK_TINTS[texName];
        const color = tint ? new THREE.Color(tint) : new THREE.Color(0xffffff);

        // Применяем освещение к частицам
        // Формула из ChunkMesher.js
        let brightness = Math.pow(0.8, 15 - lightLevel);
        const minBase = Math.pow(0.8, 15);
        brightness = (brightness - minBase) / (1 - minBase);
        brightness = Math.max(0, brightness);
        
        // Минимум яркости, чтобы частицы не были абсолютно черными (как в игре)
        brightness = Math.max(brightness, 0.02); 
        
        color.multiplyScalar(brightness);

        // Создаем материал (общий для всех частиц)
        const material = new THREE.MeshBasicMaterial({
            map: tex,
            color: color,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Создаем частицы
        for(let i=0; i<PARTICLE_COUNT; i++) {
            // Размер кусочка: 1/8 блока (0.125) до 1/4 (0.25)
            const size = (Math.random() * 0.1) + 0.1;
            
            const geo = new THREE.PlaneGeometry(size, size);
            
            // UV Mapping: Выбираем случайный кусочек текстуры
            // Текстура 16x16. Мы хотим кусочек ~4x4 пикселя.
            // 4px/16px = 0.25
            const uvSize = 0.25;
            const u = Math.random() * (1 - uvSize);
            const v = Math.random() * (1 - uvSize);
            
            const uvAttribute = geo.attributes.uv;
            // 0: 0, 1 (TL) -> u, v+size
            // 1: 1, 1 (TR) -> u+size, v+size
            // 2: 0, 0 (BL) -> u, v
            // 3: 1, 0 (BR) -> u+size, v
            
            // Порядок вершин в PlaneGeometry:
            // 0: -0.5, 0.5 (TL) -> index 0
            // 1: 0.5, 0.5 (TR) -> index 1
            // 2: -0.5, -0.5 (BL) -> index 2
            // 3: 0.5, -0.5 (BR) -> index 3
            
            uvAttribute.setXY(0, u, v + uvSize);
            uvAttribute.setXY(1, u + uvSize, v + uvSize);
            uvAttribute.setXY(2, u, v);
            uvAttribute.setXY(3, u + uvSize, v);
            
            const mesh = new THREE.Mesh(geo, material);
            
            // Позиция внутри блока
            mesh.position.set(
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6
            );
            
            // Скорость взрыва
            mesh.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                Math.random() * 4 + 1,
                (Math.random() - 0.5) * 6
            );
            
            groupRef.current.add(mesh);
            particles.current.push(mesh);
        }
        
        // Очистка при размонтировании
        return () => {
             material.dispose();
             particles.current.forEach(p => p.geometry.dispose());
        };
    }, [blockType]);

    useFrame((state, delta) => {
        const dt = Math.min(delta, 0.05);
        if (!groupRef.current) return;

        particles.current.forEach(p => {
            // Физика
            p.userData.velocity.y -= GRAVITY * dt;
            p.position.addScaledVector(p.userData.velocity, dt);
            
            // В Minecraft частицы всегда смотрят на камеру (Billboarding)
            p.lookAt(state.camera.position);
        });
    });

    return <group ref={groupRef} position={[x + 0.5, y + 0.5, z + 0.5]} />;
};

export default React.memo(Debris);