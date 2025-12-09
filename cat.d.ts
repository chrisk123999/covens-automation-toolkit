import "@client/global.mjs";
import "@common/primitives/global.mjs";
import Canvas from "@client/canvas/board.mjs";

declare global {
    class Hooks extends foundry.helpers.Hooks {}
    const fromUuid = foundry.utils.fromUuid;
    const fromUuidSync = foundry.utils.fromUuidSync;

    const canvas: Canvas;
}