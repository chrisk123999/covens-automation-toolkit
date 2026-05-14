import {Crosshairs} from '../lib/_module.mjs';
import {genericUtils} from '../utilities/_module.mjs';
const getSizeIndex = (token) => {
    const sizeStr = token.actor?.system?.traits?.size;
    const sizes = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'];
    let idx = sizes.indexOf(sizeStr);
    if (idx !== -1) return idx;
    const w = token.width ?? 1;
    if (w < 1) return 0;
    if (w === 1) return 2;
    if (w === 2) return 3;
    if (w === 3) return 4;
    return 5;
};
async function aimCrosshair({token, maxRange, crosshairsConfig, centerpoint, drawBoundries = true, checkOverlap = true, customCallbacks, trackDistance = true, fudgeDistance = 0, validityFunctions = []} = {}) {
    const tokenImg = token?.texture?.src ?? token?.document?.texture?.src;
    crosshairsConfig = crosshairsConfig || {icon: tokenImg};
    const baseIcon = crosshairsConfig.icon ?? Crosshairs.defaultCrosshairsConfig().icon;
    let distance = 0;
    let widthAdjust = 0;
    if (maxRange) maxRange = Number(maxRange);
    if (!centerpoint) {
        const actualHalf = token.width / 2;
        widthAdjust += canvas.grid.distance * Math.floor(actualHalf);
        if (!fudgeDistance && (widthAdjust !== actualHalf * canvas.grid.distance)) fudgeDistance = 2.5;
        fudgeDistance += widthAdjust;
    }
    centerpoint = centerpoint ?? token.object.center;
    let drawing;
    let container;
    let valid = true;
    const checkDistance = async (crosshairs) => {
        if (maxRange && drawBoundries) {
            const radius = (canvas.grid.size * ((maxRange + fudgeDistance + widthAdjust) / canvas.grid.distance));
            // eslint-disable-next-line no-undef
            drawing = new PIXI.Graphics();
            drawing.lineStyle(5, 0xffffff);
            const matchTemplates = game.settings.get('core', 'gridTemplates') && (game.settings.get('core', 'coneTemplateType') === 'flat');
            drawing.drawCircle(0, 0, radius);
            if (matchTemplates) drawing.drawCircle(0, 0, radius + (canvas.grid.size / 2));
            // eslint-disable-next-line no-undef
            container = new PIXI.Container();
            container.addChild(drawing);
            canvas.controls.addChild(container); 
            drawing.position.set(centerpoint.x, centerpoint.y);
        }
        while (crosshairs.inFlight) {
            await genericUtils.sleep(100);
            
            if (maxRange) {
                distance = canvas.grid.measurePath([centerpoint, crosshairs]).distance.toNearest(0.01);
                distance = Math.max(0, distance - widthAdjust);
                let isOverlapping = false;
                if (checkOverlap) {
                    const cx = crosshairs.position.x;
                    const cy = crosshairs.position.y;
                    const tokenDoc = token.document ?? token;
                    const w = (tokenDoc.width ?? 1) * canvas.grid.size;
                    const h = (tokenDoc.height ?? 1) * canvas.grid.size;
                    const r1 = {left: cx - w / 2 + 1, right: cx + w / 2 - 1, top: cy - h / 2 + 1, bottom: cy + h / 2 - 1};
                    for (let t of canvas.tokens.placeables) {
                        if (t === token.object || t.document === tokenDoc) continue; // Skip self
                        const b = t.bounds;
                        const r2 = {left: b.left, right: b.right, top: b.top, bottom: b.bottom};
                        const intersect = !(r2.left >= r1.right || r2.right <= r1.left || r2.top >= r1.bottom || r2.bottom <= r1.top);
                        if (intersect) {
                            const sizeA = getSizeIndex(tokenDoc);
                            const sizeB = getSizeIndex(t.document);
                            if (Math.abs(sizeA - sizeB) < 2) {
                                isOverlapping = true;
                                break;
                            }
                        }
                    }
                }
                if (token.object.checkCollision(crosshairs, {origin: token.object.center, type: 'move', mode: 'any'}) || distance > maxRange || isOverlapping || validityFunctions.some(i => !i(crosshairs))) {
                    crosshairs.icon = 'icons/svg/hazard.svg';
                    if (drawing) drawing.tint = 0xff0000;
                    valid = false;
                } else {
                    crosshairs.icon = baseIcon;
                    if (drawing) drawing.tint = 0x32cd32;
                    valid = true;
                }
                crosshairs.draw();
                crosshairs.label = distance + '/' + maxRange + 'ft.';
            }
        }
    };
    const callbacks = {
        show: checkDistance,
        ...(customCallbacks ?? {})
    };
    const tokenSize = token ? (token.width * canvas.dimensions.distance) / 2 : undefined;
    const tokenResolution = token ? ((token.width % 2) ? 1 : -1) : 1;
    let options = {
        size: tokenSize,
        resolution: tokenResolution,
        ...crosshairsConfig
    };
    if (trackDistance) options.label = '0ft';
    if (token.rotation) options.direction = token.rotation;
    if (!maxRange) return await Crosshairs.showCrosshairs(options);
    const result = await Crosshairs.showCrosshairs(options, callbacks);
    if (drawing) {
        drawing.destroy();
        if (container) container.destroy();
    }
    return result;
}
export default {
    aimCrosshair
};