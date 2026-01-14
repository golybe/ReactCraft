import React from 'react';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { getResolvedBlockTextures, textures } from '../../utils/textures';
import { BLOCK_TINTS } from '../../constants/colors';
import { BLOCK_TYPES } from '../../constants/blockTypes';

export const BlockIcon = ({ blockId, size = 32, style }) => {
    const block = BlockRegistry.get(blockId);
    if (!block) return null;

    const tex = getResolvedBlockTextures(blockId);
    const halfSize = size / 2;

    const isGrass = blockId === BLOCK_TYPES.GRASS;
    const isLeaves = blockId === BLOCK_TYPES.LEAVES;

    // Проверка: это предмет или блок?
    if (block.isPlaceable === false) {
        const iconUrl = tex.side || tex.top || tex.front;
        return (
            <div style={{
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                ...style
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${iconUrl})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    imageRendering: 'pixelated',
                    transform: 'scale(1.2)', // Масштабируем через transform - это работает лучше
                }} />
            </div>
        );
    }

    const tintTop = isGrass ? BLOCK_TINTS['grassTop'] : (isLeaves ? BLOCK_TINTS['leaves'] : null);
    const tintSide = isGrass ? BLOCK_TINTS['grassSide'] : (isLeaves ? BLOCK_TINTS['leaves'] : null);

    const faceBaseStyle = {
        position: 'absolute',
        width: size,
        height: size,
        backgroundSize: 'cover',
        imageRendering: 'pixelated',
        boxShadow: 'inset 0 0 4px rgba(0,0,0,0.1)', // Внутренняя тень
        backfaceVisibility: 'visible',
    };

    const getFaceStyle = (url, tint, brightness = 1) => {
        const s = {
            ...faceBaseStyle,
            backgroundImage: `url(${url})`,
            filter: `brightness(${brightness})`,
        };

        if (tint) {
            s.backgroundColor = tint;
            s.backgroundBlendMode = 'multiply';
            // Маска, чтобы цвет не заливал прозрачные области
            s.maskImage = `url(${url})`;
            s.WebkitMaskImage = `url(${url})`;
            s.maskSize = 'cover';
            s.WebkitMaskSize = 'cover';
        } else {
            s.backgroundColor = 'transparent';
        }
        return s;
    };

    const renderSideFace = (transform, brightness) => {
        if (isGrass) {
            return (
                <div style={{ ...faceBaseStyle, transform, filter: `brightness(${brightness})` }}>
                    {/* База: Земля */}
                    <div style={{ ...faceBaseStyle, width: '100%', height: '100%', backgroundImage: `url(${textures.dirt})` }} />

                    {/* Оверлей: Трава (с маской и тинтом) */}
                    <div style={{
                        ...faceBaseStyle,
                        width: '100%', height: '100%',
                        backgroundImage: `url(${tex.side})`,
                        backgroundColor: tintSide,
                        backgroundBlendMode: 'multiply',
                        maskImage: `url(${tex.side})`,
                        WebkitMaskImage: `url(${tex.side})`,
                        maskSize: 'cover',
                        WebkitMaskSize: 'cover'
                    }} />
                </div>
            );
        }
        return <div style={{ ...getFaceStyle(tex.side, tintSide, brightness), transform }} />;
    };

    // Изометрическая трансформация
    const cubeStyle = {
        width: size,
        height: size,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: 'rotateX(-30deg) rotateY(-45deg)',
    };

    return (
        <div style={{
            width: size,
            height: size,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            ...style
        }}>
            <div style={cubeStyle}>
                {/* Top Face - Y- axis (up) */}
                <div style={{
                    ...getFaceStyle(tex.top, tintTop, 1.2),
                    transform: `rotateX(90deg) translateZ(${halfSize}px)`
                }} />

                {/* Front Face (Left side in iso) - Z+ axis */}
                {renderSideFace(`translateZ(${halfSize}px)`, 0.8)}

                {/* Right Face (Right side in iso) - X+ axis */}
                {renderSideFace(`rotateY(90deg) translateZ(${halfSize}px)`, 0.6)}
            </div>
        </div>
    );
};
