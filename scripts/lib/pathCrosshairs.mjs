import {genericUtils, regionUtils} from '../utilities/_module.mjs';
import regionShapes from './regionShapes.mjs';
/**
 * Canvas tool for drawing a path of connected points (or placing a ring), then choosing which side of it is active.
 * Nothing is created on the scene; the caller receives the points and builds documents from them.
 */
export class PathCrosshairs {
    /**
     * @param {object} config See {@link PathCrosshairs.show}.
     */
    constructor(config) {
        this.config = config;
        this.points = [];
        this.closed = false;
        this.segments = [];
        this.flats = [];
        this.history = [];
        this.flat = false;
        this.flatElevation = config.panels?.elevation ?? 0;
        this.mode = config.ring ? 'ring' : config.panels ? 'panels' : 'path';
        this.diameter = config.ring?.maxDiameter ?? 0;
        this.cursor = {x: 0, y: 0};
        this.side = undefined;
        this.lastClick = 0;
        this.pixels = canvas.dimensions.distancePixels;
        this.container = new PIXI.Container();
        this.highlightGraphics = this.container.addChild(new PIXI.Graphics());
        this.graphics = this.container.addChild(new PIXI.Graphics());
        const style = CONFIG.canvasTextStyle.clone();
        style.fontSize = Math.max(Math.round(canvas.dimensions.size * 0.3), 24);
        this.text = this.container.addChild(new foundry.canvas.containers.PreciseText('', style));
        this.text.anchor.set(0.5, 1.5);
    }
    /**
     * Draw a path or place a ring on the canvas.
     * @param {object} config Tool options.
     * @param {number} [config.maxLength] Longest total path in scene units. Ignored for rings.
     * @param {boolean} [config.straight] Limit the path to one straight segment; the second click ends it.
     * @param {{count: number, size: number, flat?: boolean, elevation?: number}} [config.panels] Build the wall from this many panels of this length instead of a path. Each panel starts at the end of an earlier one, so the wall may branch. The result has `segments` instead of `points`. With `flat`, F switches to flat floor or ceiling panels placed at a height chosen with the mouse wheel, starting from `elevation`; they come back as `flats`.
     * @param {'allow'|'never'|'always'} [config.closed] Whether the path may, may not, or must be closed by clicking its first point.
     * @param {{maxDiameter: number, minDiameter?: number, step?: number, segments?: number}} [config.ring] Place a ring instead of drawing a path. The mouse wheel changes the diameter.
     * @param {boolean} [config.sides] Ask which side is active once the shape is done.
     * @param {number} [config.sideDepth] Depth of the side preview in scene units.
     * @param {number} [config.color] Preview colour.
     * @param {{path: number, side: number}} [config.highlightTokens] Outline colours for visible tokens the path crosses and tokens inside the side band. Omit for no outlines.
     * @param {Function} [config.summary] Receives the preview state `{mode, points, closed, side, sideShapes, crossed, inSide}` (points include the segment following the cursor) and returns a line of text for the help panel.
     * @param {Function} [config.isValid] Receives a point in canvas pixels; a falsy return blocks placing it.
     * @param {Function} [config.onValidity] Receives whether the pending point or ring is valid, each time the preview redraws.
     * @returns {Promise<{points?: {x: number, y: number}[], segments?: [{x: number, y: number}, {x: number, y: number}][], closed: boolean, side: 'left'|'right'|'inside'|'outside'|undefined, ring: {x: number, y: number, radius: number}|undefined}|null>} Null when cancelled.
     */
    static async show(config = {}) {
        PathCrosshairs.active?.finish(null);
        const tool = new PathCrosshairs({closed: config.straight ? 'never' : 'allow', sides: true, sideDepth: 10, color: 0xff6400, ...config});
        PathCrosshairs.active = tool;
        return tool.run();
    }
    /** The tool currently drawing, if any. Opening a new one cancels it. */
    static active;
    run() {
        canvas.controls.addChild(this.container);
        return new Promise(resolve => {
            this.resolve = resolve;
            this.handlers = {
                move: event => this.onMove(event),
                down: event => this.onDown(event),
                right: event => this.onRight(event),
                wheel: event => this.onWheel(event),
                key: event => this.onKey(event)
            };
            canvas.app.stage.on('mousemove', this.handlers.move);
            canvas.app.stage.on('mousedown', this.handlers.down);
            canvas.app.stage.on('rightdown', this.handlers.right);
            canvas.app.view.addEventListener('wheel', this.handlers.wheel, {passive: false});
            window.addEventListener('keydown', this.handlers.key, {capture: true});
            this.help = document.createElement('aside');
            this.help.classList.add('cat', 'cat-dialog', 'cat-path-help');
            document.body.append(this.help);
            this.cursor = canvas.app.renderer.events.pointer.getLocalPosition(canvas.controls);
            this.refresh();
        });
    }
    finish(result) {
        if (this.finished) return;
        this.finished = true;
        if (PathCrosshairs.active === this) PathCrosshairs.active = undefined;
        this.help?.remove();
        canvas.app.stage.off('mousemove', this.handlers.move);
        canvas.app.stage.off('mousedown', this.handlers.down);
        canvas.app.stage.off('rightdown', this.handlers.right);
        canvas.app.view.removeEventListener('wheel', this.handlers.wheel);
        window.removeEventListener('keydown', this.handlers.key, {capture: true});
        this.container.destroy({children: true});
        this.resolve(result);
    }
    snap(point, event) {
        this.free = !!(event?.shiftKey || event?.data?.originalEvent?.shiftKey);
        if (this.free) return point;
        const modes = CONST.GRID_SNAPPING_MODES;
        return canvas.grid.getSnappedPoint(point, {mode: this.mode === 'panels' ? modes.VERTEX : modes.CENTER | modes.VERTEX});
    }
    panelCount() {
        return this.segments.length + this.flats.length;
    }
    flatCorners(flat) {
        return [{x: flat.x, y: flat.y}, {x: flat.x + flat.size, y: flat.y}, {x: flat.x, y: flat.y + flat.size}, {x: flat.x + flat.size, y: flat.y + flat.size}];
    }
    panelEnds() {
        const ends = [...this.segments.flat(), ...this.flats.flatMap(flat => this.flatCorners(flat))];
        return ends.length ? ends : [this.panelStart];
    }
    pendingFlat() {
        const size = this.config.panels.size * this.pixels;
        const corner = canvas.grid.getSnappedPoint({x: this.cursor.x - size / 2, y: this.cursor.y - size / 2}, {mode: CONST.GRID_SNAPPING_MODES.VERTEX});
        return {x: corner.x, y: corner.y, size, elevation: this.flatElevation};
    }
    touches(flat) {
        if (!this.panelCount()) return true;
        const area = new PIXI.Rectangle(flat.x - 1, flat.y - 1, flat.size + 2, flat.size + 2);
        if (this.segments.some(([a, b]) => area.contains(a.x, a.y) || area.contains(b.x, b.y) || area.lineSegmentIntersects(a, b))) return true;
        return this.flats.some(other => area.intersects(new PIXI.Rectangle(other.x, other.y, other.size, other.size)));
    }
    pendingPanel() {
        if (this.flat || (!this.panelStart && !this.flats.length)) return;
        const anchor = this.panelEnds().reduce((best, point) => Math.hypot(point.x - this.cursor.x, point.y - this.cursor.y) < Math.hypot(best.x - this.cursor.x, best.y - this.cursor.y) ? point : best);
        let angle = Math.atan2(this.cursor.y - anchor.y, this.cursor.x - anchor.x);
        if (!this.free) angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const diagonal = this.gridMeasured() && Math.abs(Math.cos(angle)) > 0.1 && Math.abs(Math.sin(angle)) > 0.1;
        if (diagonal) return [anchor, this.diagonalEnd(anchor, Math.sign(Math.cos(angle)), Math.sign(Math.sin(angle)))];
        const length = this.config.panels.size * this.pixels;
        return [anchor, {x: anchor.x + Math.cos(angle) * length, y: anchor.y + Math.sin(angle) * length}];
    }
    /**
     * Whether lengths follow the scene's diagonal rule instead of straight-line distance.
     * @returns {boolean}
     */
    gridMeasured() {
        return !this.free && canvas.grid.isSquare && canvas.grid.diagonals !== CONST.GRID_DIAGONALS.EXACT;
    }
    /**
     * End of a diagonal panel measured with the scene's diagonal rule, in whole grid cells.
     * @param {{x: number, y: number}} anchor Panel start.
     * @param {number} dx Horizontal direction, -1 or 1.
     * @param {number} dy Vertical direction, -1 or 1.
     * @returns {{x: number, y: number}}
     */
    diagonalEnd(anchor, dx, dy) {
        const step = cells => ({x: anchor.x + dx * cells * canvas.grid.size, y: anchor.y + dy * cells * canvas.grid.size});
        let cells = 1;
        while (canvas.grid.measurePath([anchor, step(cells + 1)]).distance <= this.config.panels.size) cells++;
        return step(cells);
    }
    addPanel() {
        if (this.flat) {
            const flat = this.pendingFlat();
            if (this.flats.some(other => other.x === flat.x && other.y === flat.y && other.elevation === flat.elevation)) return;
            if (!this.touches(flat)) return genericUtils.notify('CAT.Crosshairs.PanelNotConnected', {type: 'warn'});
            this.flats.push(flat);
            this.history.push('flat');
        } else {
            if (!this.panelStart && !this.flats.length) {
                this.panelStart = {...this.cursor};
                return this.refresh();
            }
            const panel = this.pendingPanel();
            const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1;
            if (this.segments.some(([a, b]) => (same(a, panel[0]) && same(b, panel[1])) || (same(a, panel[1]) && same(b, panel[0])))) return;
            this.segments.push(panel);
            this.history.push('segment');
        }
        if (this.panelCount() >= this.config.panels.count) return this.done();
        this.refresh();
    }
    usedLength(points = this.points) {
        if (this.gridMeasured()) return points.length > 1 ? canvas.grid.measurePath(points).distance : 0;
        let total = 0;
        for (let index = 1; index < points.length; index++) total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
        return total / this.pixels;
    }
    clampNext(point) {
        const last = this.points.at(-1);
        if (!last || !this.config.maxLength) return point;
        if (this.gridMeasured()) {
            if (this.usedLength([...this.points, point]) <= this.config.maxLength) return point;
            const along = fraction => ({x: last.x + (point.x - last.x) * fraction, y: last.y + (point.y - last.y) * fraction});
            let low = 0;
            let high = 1;
            for (let step = 0; step < 20; step++) {
                const middle = (low + high) / 2;
                if (this.usedLength([...this.points, along(middle)]) <= this.config.maxLength) low = middle;
                else high = middle;
            }
            return along(low);
        }
        const remaining = (this.config.maxLength - this.usedLength()) * this.pixels;
        const length = Math.hypot(point.x - last.x, point.y - last.y);
        if (length <= remaining) return point;
        if (remaining <= 0) return {...last};
        return {x: last.x + (point.x - last.x) / length * remaining, y: last.y + (point.y - last.y) / length * remaining};
    }
    nearFirst(point) {
        const first = this.points[0];
        return this.config.closed !== 'never' && this.points.length > 2 && first && Math.hypot(point.x - first.x, point.y - first.y) < canvas.grid.size / 3;
    }
    nearLast(point) {
        const last = this.points.at(-1);
        return this.points.length > 1 && Math.hypot(point.x - last.x, point.y - last.y) < canvas.grid.size / 3;
    }
    lengthUsedUp() {
        return !!this.config.maxLength && this.points.length > 1 && this.usedLength() >= this.config.maxLength - 0.01;
    }
    canClose() {
        if (this.config.closed === 'never' || this.points.length < 3) return false;
        return !this.config.maxLength || this.usedLength([...this.points, this.points[0]]) <= this.config.maxLength + 0.01;
    }
    ringPoints() {
        const segments = this.config.ring.segments ?? 24;
        const radius = this.diameter / 2 * this.pixels;
        return Array.fromRange(segments).map(index => {
            const angle = index / segments * Math.PI * 2;
            return {x: this.cursor.x + Math.cos(angle) * radius, y: this.cursor.y + Math.sin(angle) * radius};
        });
    }
    trackCursor(event) {
        const position = event.data.getLocalPosition(canvas.controls);
        this.cursor = this.mode === 'side' ? position : this.snap(position, event);
        if (this.mode === 'side') this.side = this.getSide(position);
    }
    onMove(event) {
        event.stopPropagation();
        this.trackCursor(event);
        this.refresh();
    }
    pendingValid(ringPoints, next) {
        if (!this.config.isValid || this.mode === 'side') return true;
        if (this.mode === 'panels') return !!this.config.isValid(this.pendingPanel()?.[1] ?? this.cursor);
        if (this.mode === 'ring') return (ringPoints ?? this.ringPoints()).every(point => this.config.isValid(point));
        if (this.nearFirst(this.cursor)) return true;
        return !!this.config.isValid(next ?? (this.points.length ? this.clampNext(this.cursor) : this.cursor));
    }
    onDown(event) {
        if (event.data?.button !== 0) return;
        event.stopPropagation();
        this.trackCursor(event);
        if (this.mode === 'side') return this.done();
        if (!this.pendingValid()) return genericUtils.notify('CAT.Crosshairs.Invalid', {type: 'warn'});
        if (this.mode === 'panels') return this.addPanel();
        if (this.mode === 'ring') {
            this.points = this.ringPoints();
            this.ring = {x: this.cursor.x, y: this.cursor.y, radius: this.diameter / 2 * this.pixels};
            this.closed = true;
            return this.toSides();
        }
        const now = Date.now();
        const doubleClick = now - this.lastClick < 300;
        this.lastClick = now;
        if (this.nearFirst(this.cursor)) {
            if (!this.canClose()) return genericUtils.notify('CAT.Crosshairs.PathTooLong', {type: 'warn'});
            this.closed = true;
            return this.toSides();
        }
        if (this.points.length > 1 && (doubleClick || this.nearLast(this.cursor) || this.lengthUsedUp())) return this.endPath();
        const point = this.clampNext(this.cursor);
        const last = this.points.at(-1);
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1) return;
        this.points.push(point);
        if (this.config.straight && this.points.length === 2) return this.endPath();
        this.refresh();
    }
    onRight(event) {
        if (event.data?.button !== 2) return;
        event.stopPropagation();
        if (this.mode === 'side') {
            this.mode = this.ring ? 'ring' : 'path';
            this.closed = false;
            if (this.ring) this.points = [];
            this.side = undefined;
            this.sideShapes = undefined;
            return this.refresh();
        }
        if (this.mode === 'path' && this.points.length) {
            this.points.pop();
            return this.refresh();
        }
        if (this.mode === 'panels' && (this.panelStart || this.history.length)) {
            const last = this.history.pop();
            if (last === 'flat') this.flats.pop();
            else if (last === 'segment') this.segments.pop();
            else this.panelStart = undefined;
            return this.refresh();
        }
        this.finish(null);
    }
    onWheel(event) {
        if (this.mode === 'panels' && this.flat) {
            event.preventDefault();
            event.stopPropagation();
            this.flatElevation = Math.max(0, this.flatElevation - Math.sign(event.deltaY) * canvas.grid.distance);
            return this.refresh();
        }
        if (this.mode !== 'ring') return;
        event.preventDefault();
        event.stopPropagation();
        const {maxDiameter, minDiameter = 5, step = 5} = this.config.ring;
        this.diameter = Math.clamp(this.diameter - Math.sign(event.deltaY) * step, minDiameter, maxDiameter);
        this.refresh();
    }
    onKey(event) {
        let action;
        if (event.key === 'Escape') action = () => this.finish(null);
        else if (event.key === 'Enter' && this.mode === 'path' && this.points.length > 1) action = () => this.endPath();
        else if (event.key === 'Enter' && this.mode === 'panels' && this.panelCount()) action = () => this.done();
        else if (event.key.toLowerCase() === 'f' && this.mode === 'panels' && this.config.panels.flat) action = () => {
            this.flat = !this.flat;
            this.refresh();
        };
        if (!action) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        action();
    }
    endPath() {
        if (this.config.closed === 'always') return genericUtils.notify('CAT.Crosshairs.PathMustClose', {type: 'warn'});
        this.closed = false;
        this.toSides();
    }
    toSides() {
        if (!this.config.sides) return this.done();
        this.mode = 'side';
        this.sideShapes = {};
        this.closedPolygon = this.closed ? new PIXI.Polygon(this.points.flatMap(point => [point.x, point.y])) : undefined;
        this.side = this.getSide(this.cursor);
        this.refresh();
    }
    done() {
        if (this.mode === 'panels') return this.finish({segments: this.segments.map(segment => segment.map(point => ({x: point.x, y: point.y}))), flats: this.flats.map(flat => ({...flat})), closed: false});
        this.finish({points: this.points.map(point => ({x: point.x, y: point.y})), closed: this.closed, side: this.config.sides ? this.side : undefined, ring: this.ring});
    }
    getSide(point) {
        if (this.closed) return this.closedPolygon.contains(point.x, point.y) ? 'inside' : 'outside';
        const best = regionShapes.nearestSegment(point, regionShapes.pathSegments({points: this.points}));
        if (!best) return 'left';
        const cross = (best.b.x - best.a.x) * (point.y - best.a.y) - (best.b.y - best.a.y) * (point.x - best.a.x);
        return cross < 0 ? 'left' : 'right';
    }
    startRefresh(points, next) {
        const valid = this.pendingValid(points, next);
        this.config.onValidity?.(valid);
        return {graphics: this.graphics.clear(), color: valid ? this.config.color : 0xff0000, width: Math.max(canvas.grid.size / 12, 3)};
    }
    endRefresh(label, state) {
        this.text.text = label;
        this.text.position.set(this.cursor.x, this.cursor.y);
        this.drawHighlights(state);
        this.renderHelp(this.config.summary?.(state));
    }
    refreshPanels() {
        const {graphics, color, width} = this.startRefresh();
        const pending = this.pendingPanel();
        this.flats.forEach(flat => graphics.lineStyle(width / 2, color, 0.9).beginFill(color, 0.3).drawRect(flat.x, flat.y, flat.size, flat.size).endFill());
        if (this.flat) {
            const flat = this.pendingFlat();
            graphics.lineStyle(width / 2, this.touches(flat) ? color : 0xff0000, 0.6).beginFill(color, 0.15).drawRect(flat.x, flat.y, flat.size, flat.size).endFill();
        }
        graphics.lineStyle(width, color, 0.9);
        this.segments.forEach(([a, b]) => graphics.moveTo(a.x, a.y).lineTo(b.x, b.y));
        if (pending) graphics.lineStyle(width, color, 0.5).moveTo(pending[0].x, pending[0].y).lineTo(pending[1].x, pending[1].y);
        graphics.lineStyle(0).beginFill(color, 0.9);
        if (!this.flat) (this.panelStart || this.flats.length ? this.panelEnds() : [this.cursor]).forEach(point => graphics.drawCircle(point.x, point.y, width * 1.5));
        graphics.endFill();
        let label = this.panelCount() + ' / ' + this.config.panels.count;
        if (this.flat) label += ' · ' + _loc('CAT.Crosshairs.FlatAt', {elevation: this.flatElevation, units: canvas.scene.grid.units});
        const state = {mode: this.mode, segments: pending ? [...this.segments, pending] : [...this.segments], closed: false};
        state.crossed = state.segments.length ? regionUtils.tokensOnPath(canvas.scene, state, {visibleOnly: true}) : [];
        state.inSide = [];
        this.endRefresh(label, state);
    }
    refresh() {
        if (this.mode === 'panels') return this.refreshPanels();
        const points = this.mode === 'ring' ? this.ringPoints() : this.points;
        const next = this.mode === 'path' && this.points.length ? this.clampNext(this.cursor) : this.cursor;
        const {graphics, color, width} = this.startRefresh(points, next);
        let sideShapes;
        if (this.mode === 'side') {
            const shapes = sideShapes = this.sideShapes[this.side] ??= regionShapes.sideBand(this.points, this.closed, this.side, this.config.sideDepth * this.pixels);
            graphics.beginFill(color, 0.25);
            shapes.filter(shape => !shape.hole).forEach(shape => graphics.drawPolygon(shape.points));
            graphics.beginHole();
            shapes.filter(shape => shape.hole).forEach(shape => graphics.drawPolygon(shape.points));
            graphics.endHole().endFill();
        }
        graphics.lineStyle(width, color, 0.9);
        if (points.length) {
            graphics.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
            if (this.closed || this.mode === 'ring') graphics.lineTo(points[0].x, points[0].y);
        }
        let label = '';
        if (this.mode === 'path') {
            if (this.points.length) {
                graphics.lineStyle(width, color, 0.5).moveTo(this.points.at(-1).x, this.points.at(-1).y).lineTo(next.x, next.y);
            }
            graphics.lineStyle(0).beginFill(color, 0.9);
            this.points.forEach(point => graphics.drawCircle(point.x, point.y, width * 1.5));
            graphics.endFill();
            if (this.canClose()) {
                const first = this.points[0];
                graphics.lineStyle(width / 2, 0xffffff, this.nearFirst(this.cursor) ? 1 : 0.6).drawCircle(first.x, first.y, width * 3);
            }
            if (this.points.length > 1) {
                const last = this.points.at(-1);
                graphics.lineStyle(width / 2, 0xffffff, this.nearLast(this.cursor) || this.lengthUsedUp() ? 1 : 0.6).drawRect(last.x - width * 2.5, last.y - width * 2.5, width * 5, width * 5);
            }
            const used = this.usedLength(this.points.length ? [...this.points, next] : []);
            label = this.config.maxLength ? used.toNearest(0.5) + ' / ' + this.config.maxLength + ' ' + canvas.scene.grid.units : '';
        } else if (this.mode === 'ring') {
            label = this.diameter + ' ' + canvas.scene.grid.units;
        } else {
            label = _loc('CAT.Crosshairs.Sides.' + (this.side ?? 'left').capitalize());
        }
        this.endRefresh(label, this.previewState(points, next, sideShapes));
    }
    previewState(points, next, sideShapes) {
        let state;
        if (this.mode === 'ring') state = {mode: this.mode, points, closed: true};
        else if (this.mode === 'side') state = {mode: this.mode, points, closed: this.closed, side: this.side, sideShapes};
        else state = {mode: this.mode, points: points.length ? [...points, next] : [], closed: false};
        state.crossed = state.points.length > 1 ? regionUtils.tokensOnPath(canvas.scene, state, {visibleOnly: true}) : [];
        const crossed = new Set(state.crossed);
        state.inSide = sideShapes ? canvas.tokens.placeables.filter(token => token.actor && token.visible && !crossed.has(token) && regionShapes.containsPoint(sideShapes, token.center)) : [];
        return state;
    }
    drawHighlights(state) {
        const graphics = this.highlightGraphics.clear();
        const colors = this.config.highlightTokens;
        if (!colors) return;
        const pad = canvas.grid.size * 0.08;
        for (const [tokens, color] of [[state.crossed, colors.path], [state.inSide, colors.side]]) {
            tokens.forEach(token => {
                const {x, y, width, height} = token.bounds;
                graphics.lineStyle(Math.max(canvas.grid.size / 20, 2), color, 0.95).beginFill(color, 0.18).drawRoundedRect(x - pad, y - pad, width + pad * 2, height + pad * 2, pad * 2).endFill();
            });
        }
    }
    renderHelp(summary) {
        const key = 'CAT.Crosshairs.Help.';
        const usedUp = this.mode === 'path' && this.lengthUsedUp();
        const lines = {
            path: [['Click', usedUp ? 'Finish' : (this.config.straight && this.points.length ? 'PlaceEnd' : 'AddPoint')], ...(usedUp ? [] : [['Shift', 'Free']]), ['RightClick', 'Undo'], ...(this.canClose() ? [['FirstPoint', 'Close']] : []), ...(!usedUp && this.points.length > 1 ? [['LastPoint', 'Finish']] : []), ['Esc', 'Cancel']],
            ring: [['Scroll', 'Resize'], ['Click', 'PlaceRing'], ['Esc', 'Cancel']],
            panels: [['Click', this.flat ? 'AddFlat' : (this.panelStart || this.flats.length ? 'AddPanel' : 'StartPanels')], ...(this.flat ? [['Scroll', 'FlatHeight']] : [['Shift', 'FreeAngle']]), ...(this.config.panels?.flat ? [['F', 'ToggleFlat']] : []), ['RightClick', 'UndoPanel'], ...(this.panelCount() ? [['Enter', 'FinishPanels']] : []), ['Esc', 'Cancel']],
            side: [['Move', 'ChooseSide'], ['Click', 'Confirm'], ['RightClick', 'Back'], ['Esc', 'Cancel']]
        }[this.mode];
        let notice = '';
        if (usedUp) notice = _loc(key + 'LengthUsed');
        else if (this.mode === 'path' && !this.points.length) notice = _loc(key + (this.config.straight ? 'StartStraight' : 'Start'));
        else if (this.mode === 'panels' && !this.panelStart && !this.panelCount()) notice = _loc(key + 'PanelsStart');
        const html = '<div class="body">'
            + (notice ? `<p>${notice}</p>` : '')
            + (summary ? `<p>${summary}</p>` : '')
            + '<dl>' + lines.map(([input, action]) => `<dt>${_loc(key + 'Keys.' + input)}</dt><dd>${_loc(key + action)}</dd>`).join('') + '</dl></div>';
        if (html !== this.helpHtml) this.help.innerHTML = this.helpHtml = html;
    }
}
