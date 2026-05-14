export class Crosshairs extends foundry.canvas.placeables.Region {
    constructor(config, callbacks = {}) {
        const shapes = [];
        const shapeType = config.shape ?? 'circle';
        const size = config.size ?? (canvas.dimensions.distance / 2); 
        if (shapeType === 'rect') {
            shapes.push({type: 'rectangle', width: size, height: size, x: config.x, y: config.y});
        } else if (shapeType === 'circle') {
            shapes.push({type: 'circle', radius: size, x: config.x, y: config.y});
        }
        const regionData = {
            name: 'Crosshairs Preview',
            shapes: shapes,
            elevation: {bottom: 99999, top: 99999}
        };
        const regionDoc = new CONFIG.Region.documentClass(regionData, {parent: canvas.scene});
        super(regionDoc);
        this.icon = config.icon ?? 'icons/svg/target.svg';
        this.label = config.label;
        this.labelOffset = config.labelOffset;
        this.tag = config.tag;
        this.drawIcon = config.drawIcon;
        this.drawOutline = config.drawOutline;
        this.fillAlpha = config.fillAlpha;
        this.tileTexture = config.tileTexture;
        this.lockSize = config.lockSize;
        this.lockPosition = config.lockPosition;
        this.direction = config.direction ?? 0;
        this.resolution = config.resolution;
        this.callbacks = callbacks;
        this.inFlight = false;
        this.cancelled = true;
        this.rightX = 0;
        this.rightY = 0;
        this.radius = (size / canvas.dimensions.distance) * canvas.dimensions.size;
        this.distance = size;
    }
    static defaultCrosshairsConfig() {
        return {
            size: canvas.dimensions.distance,
            icon: 'icons/svg/dice-target.svg',
            label: '',
            labelOffset: {
                x: 0,
                y: 0
            },
            tag: 'crosshairs',
            drawIcon: true,
            drawOutline: true,
            resolution: 2,
            fillAlpha: 0,
            tileTexture: false,
            lockSize: true,
            lockPosition: false,
            rememberControlled: false,
            texture: null,
            direction: 0,
            fillColor: game.user.color
        };
    }
    static async showCrosshairs(config = {}, callbacks = {}) {
        config = foundry.utils.mergeObject(config, Crosshairs.defaultCrosshairsConfig(), {overwrite: false});
        let controlled = [];
        if (config.rememberControlled) {
            controlled = canvas.tokens.controlled;
        }
        if (!Object.prototype?.hasOwnProperty?.call(config, 'x') && !Object.prototype?.hasOwnProperty?.call(config, 'y')) {
            let mouseLoc = canvas.app.renderer.events.pointer.getLocalPosition(canvas.app.stage);
            mouseLoc = Crosshairs.getSnappedPosition(mouseLoc, config.resolution);
            config.x = mouseLoc.x;
            config.y = mouseLoc.y;
        }
        const template = new Crosshairs(config, callbacks);
        await template.drawPreview();
        let dataObj = template.toObject();
        for (const token of controlled) {
            token.control({releaseOthers: false});
        }
        template.destroy();
        return dataObj;
    }
    toObject() {
        const data = foundry.utils.mergeObject(this.document.toObject(), {
            cancelled: this.cancelled,
            scene: this.scene,
            radius: this.radius,
            size: this.distance
        });
        delete data.width;
        return data;
    }
    static collectPlaceables(crosshairsData, types = 'Token', containedFilter = Crosshairs._containsCenter) {
        let isArray = Array.isArray(types);
        if (!isArray) types = [types];
        let result = types.reduce((acc, embeddedName) => {
            let collection = crosshairsData.scene.getEmbeddedCollection(embeddedName);
            let contained = collection.filter((document) => {
                return containedFilter(document.object, crosshairsData);
            });
            acc[embeddedName] = contained;
            return acc;
        }, {});
        return isArray ? result : result[types[0]];
    }
    static _containsCenter(placeable, crosshairsData) {
        const calcDistance = (A, B) => {
            return Math.hypot(A.x - B.x, A.y - B.y);
        };
        let distance = calcDistance(placeable.center, crosshairsData);
        return distance <= crosshairsData.radius;
    }
    static getCrosshair(tag) {
        return canvas.regions.preview.children.find(child => child.tag === tag);
    }
    static getSnappedPosition({x,y}, resolution){
        const offset = resolution < 0 ? canvas.grid.size / 2 : 0;
        const snapped = canvas.grid.getSnappedPoint({x: x - offset, y: y - offset}, {mode: 1, resolution: resolution});
        return {x: snapped.x + offset, y: snapped.y + offset};
    }
    static ERROR_TEXTURE = 'icons/svg/hazard.svg';
    async drawPreview() {
        await this.draw();
        canvas.regions.preview.addChild(this); 
        this.layer.interactiveChildren = false;
        this.inFlight = true;
        this.activatePreviewListeners();
        this.callbacks?.show?.(this);
        await this.waitFor(() => !this.inFlight, -1);
        if (this.activeHandlers) this.clearHandlers();
        return this;
    }
    /** @override */
    async draw() {
        // eslint-disable-next-line no-undef
        if (!this.template) this.template = this.addChild(new PIXI.Graphics());
        if (this.controlIcon && this._currentIconStr !== this.icon) {
            this.controlIcon.destroy();
            this.controlIcon = null;
        }
        if (!this.controlIcon && this.drawIcon) {
            this.controlIcon = this.addChild(this._drawControlIcon());
            await this.controlIcon.draw();
            this._currentIconStr = this.icon;
        }
        if (!this.ruler) this.ruler = this.addChild(this._drawRulerText());
        const texture = this.document.texture;
        if (texture)  {
            // eslint-disable-next-line no-undef
            this._texture = await loadTexture(texture, {fallback: 'icons/svg/hazard.svg'}); 
        } else {
            this._texture = null;
        }
        this.refresh();
        return this;
    }
    _setRulerText() {
        this.ruler.text = this.label;
        this.ruler.position.set(-this.ruler.width / 2 + this.labelOffset.x, this.template.height / 2 + 5 + this.labelOffset.y);
    }
    _drawRulerText() {
        const style = CONFIG.canvasTextStyle.clone();
        style.fontSize = Math.max(Math.round(canvas.dimensions.size * 0.36 * 12) / 12, 36);
        const text = new foundry.canvas.containers.PreciseText(null, style);
        text.anchor.set(0, 0);
        return text;
    }
    _drawControlIcon() {
        const size = Math.max(Math.round((canvas.dimensions.size * 0.5) / 20) * 20, 40);
        let icon = new foundry.canvas.containers.ControlIcon({texture: this.icon, size: size});
        icon.visible = this.drawIcon;
        icon.pivot.set(size * 0.5, size * 0.5);
        icon.angle = this.document.direction;
        return icon;
    }
    /** @override */
    refresh() {
        if (!this.template || this.destroyed || this._destroyed) return;
        const document = this.document;
        const shapeData = document.shapes[0];
        if (!shapeData) return;
        const x = shapeData.x ?? 0;
        const y = shapeData.y ?? 0;
        this.position.set(x, y);
        let distance = shapeData.radius ?? shapeData.width ?? (canvas.dimensions.distance / 2);
        let distancePixels = (distance / canvas.dimensions.distance) * canvas.dimensions.size;
        let direction = this.direction ?? 0;
        let directionRad = Math.toRadians(direction);
        this.ray = foundry.canvas.geometry.Ray.fromAngle(x, y, directionRad, distancePixels);
        this.t = this.computeShape();
        if (!this.t) return;
        const regionSchema = CONFIG.Region.documentClass.schema.fields;
        const fillColor = document.color ?? regionSchema.color.initial ?? 0xFFFFFF;
        const lineColor = 0x000000;
        const thickness = 2;
        this.template.clear().lineStyle(thickness, lineColor, this.drawOutline ? 0.75 : 0);
        if (this._texture) {
            let scale = this.tileTexture ? 1 : distancePixels * 2 / this._texture.width;
            let offset = this.tileTexture ? 0 : distancePixels;
            this.template.beginTextureFill({
                texture: this._texture,
                // eslint-disable-next-line no-undef
                matrix: new PIXI.Matrix().scale(scale, scale).translate(-offset, -offset)
            });
        } else {
            this.template.beginFill(fillColor, this.fillAlpha);
        }
        this.template.drawShape(this.t);
        this.template.endFill();
        if (this.drawIcon && this.controlIcon) {
            this.controlIcon.visible = true;
            this.controlIcon.border.visible = this._hover;
            this.controlIcon.angle = direction;
        }
        if (this._setRulerText) {
            this._setRulerText();
        }
        return this;
    }
    activatePreviewListeners() {
        return new Promise((resolve, reject) => {
            this.activeHandlers = true;
            this.handlers = {};
            let moveTime = 0;
            this.handlers.mm = event => {
                event.stopPropagation();
                if (this.lockPosition) return;
                let now = Date.now();
                if (now - moveTime <= 20) return;
                const center = event.data.getLocalPosition(canvas.regions.preview);
                const {x,y} = Crosshairs.getSnappedPosition(center, this.resolution);
                let shapes = foundry.utils.deepClone(this.document.shapes);
                shapes[0].x = x;
                shapes[0].y = y;
                this.document.updateSource({shapes});
                this.refresh();
                moveTime = now;
                if (now - this.initTime > 1000) {
                    canvas._onDragCanvasPan(event.data.originalEvent);
                }
            };
            this.handlers.lc = event => {
                if (event.data?.button !== 0) return;
                event.stopPropagation();
                const currentLoc = {x: this.document.shapes[0].x, y: this.document.shapes[0].y};
                const destination = Crosshairs.getSnappedPosition(currentLoc, this.resolution);
                let distance = this.document.shapes[0].radius ?? this.document.shapes[0].width ?? 1;
                this.radius = (distance / canvas.dimensions.distance) * canvas.dimensions.size;
                this.cancelled = false;
                let shapes = foundry.utils.deepClone(this.document.shapes);
                shapes[0].x = destination.x;
                shapes[0].y = destination.y;
                this.document.updateSource({shapes});
                this.clearHandlers(event);
                return true;
            };
            this.handlers.rc = event => {
                if (event.data?.button !== 2) return;
                event.stopPropagation();
                this.rightX = event.data.getLocalPosition(canvas.regions.preview).x;
                this.rightY = event.data.getLocalPosition(canvas.regions.preview).y;
                this.clearHandlers(event);
            };
            this.handlers.mw = event => {
                if (event.ctrlKey) event.preventDefault();
                if (!event.altKey) event.stopPropagation();
                // eslint-disable-next-line no-undef
                const delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
                const snap = event.ctrlKey ? delta : 5;
                if (event.shiftKey && !this.lockSize) {
                    let shapes = foundry.utils.deepClone(this.document.shapes);
                    let currentDist = shapes[0].radius ?? shapes[0].width ?? 1;
                    let distance = currentDist + 0.25 * (Math.sign(event.deltaY));
                    distance = Math.max(distance, 0.25);
                    
                    if (shapes[0].type === 'circle') shapes[0].radius = distance;
                    else { shapes[0].width = distance; shapes[0].height = distance; }
                    
                    this.document.updateSource({shapes});
                    this.radius = (distance / canvas.dimensions.distance) * canvas.dimensions.size;
                    this.distance = distance;
                } else if (!event.altKey) {
                    this.direction = this.direction + (snap * Math.sign(event.deltaY));
                }
                this.refresh();
            };
            canvas.app.stage.on('mousemove', this.handlers.mm);
            canvas.app.stage.on('mousedown', this.handlers.lc);
            canvas.app.stage.on('rightdown', this.handlers.rc);
            canvas.app.view.addEventListener('wheel', this.handlers.mw, {passive: false});
            resolve(true);
        });
    }
    clearHandlers(event) {
        if (!this.activeHandlers) return;
        canvas.app.stage.off('mousemove', this.handlers.mm);
        canvas.app.stage.off('mousedown', this.handlers.lc);
        canvas.app.stage.off('rightdown', this.handlers.rc);
        canvas.app.view.removeEventListener('wheel', this.handlers.mw);
        this.activeHandlers = false;
        this.inFlight = false;
        if (event) {
            canvas._onDragCanvasPan(event.data?.originalEvent ?? event);
        }
    }
    destroy(options) {
        this._destroyed = true;
        this.clearHandlers();
        if (this.parent) this.parent.removeChild(this); 
        if (super.destroy) super.destroy(options);
    }
    computeShape() {
        const shapeData = this.document.shapes[0];
        if (!shapeData) return null;
        let distance = shapeData.radius ?? shapeData.width ?? (canvas.dimensions.distance / 2);
        let distancePixels = (distance / canvas.dimensions.distance) * canvas.dimensions.size;
        if (shapeData.type === 'rectangle') {
            let length = distancePixels * 2; 
            // eslint-disable-next-line no-undef
            return new PIXI.Rectangle(-length / 2, -length / 2, length, length);
        } 
        else if (shapeData.type === 'circle') {
            let radius = distancePixels;
            if (!game.settings.get('core', 'gridTemplates')) {
                radius = Math.round(radius / (canvas.dimensions.size / 2)) * (canvas.dimensions.size / 2);
            }
            // eslint-disable-next-line no-undef
            return new PIXI.Circle(0, 0, radius);
        }
        return null;
    }
    async waitFor(fn, maxIter = 600, iterWaitTime = 100) {
        let i = 0;
        const continueWait = (current, max) => {
            if (maxIter < 0) return true;
            return current < max;
        };
        while (!fn(i, (i * iterWaitTime)) && continueWait(i, maxIter)) {
            i++;
            await new Promise(resolve => setTimeout(resolve, iterWaitTime));
        }
        return i;
    }
}