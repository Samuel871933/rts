import { MAP_SIZE } from '@macrogod/shared';
import { Container, Sprite, Texture } from 'pixi.js';
import { paintMap } from '../mapPaint';

/** Texture size: the map shows at a fixed zoom (whole rift in view), so this stays crisp. */
const TEXTURE_PX = 2048;

/** Static terrain, painted once to a canvas texture. */
export class MapLayer extends Container {
  private readonly texture: Texture;

  constructor() {
    super();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_PX;
    paintMap(canvas.getContext('2d')!, TEXTURE_PX);
    this.texture = Texture.from(canvas);
    const sprite = new Sprite(this.texture);
    sprite.scale.set(MAP_SIZE / TEXTURE_PX);
    this.addChild(sprite);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    super.destroy(options);
    this.texture.destroy(true);
  }
}
