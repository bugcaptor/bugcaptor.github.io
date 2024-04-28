import './style.css';
import { SpaceRenderer } from './space_renderer';
import { RendererInterface } from './renderer';
import { RainRenderer } from './rain_renderer';
import { FlowerFallingRenderer } from './flower_falling_renderer';
import { pickWeightedRandom } from './utility';

function hideBottomMenu() {
  const bottomMenu = document.getElementById('bottom_menu') as HTMLDivElement;
  const easeTimeStep = 5;
  const alphaStepPerSec = 1;
  let prevTime = performance.now();
  let alpha = 1;
  function easeToTransparent() {
    const now = performance.now();
    const dt = (now - prevTime) * 0.001;
    prevTime = now;
    alpha -= dt * alphaStepPerSec;
    if (alpha > 0) {
      bottomMenu.style.opacity = alpha.toString();
      setTimeout(easeToTransparent, easeTimeStep);
    } else {
      bottomMenu.style.display = 'none';
      bottomMenu.style.opacity = '0';
    }
  }
  setTimeout(easeToTransparent, easeTimeStep);
}

function showBottomMenu() {
  const bottomMenu = document.getElementById('bottom_menu') as HTMLDivElement;
  const easeTimeStep = 5;
  const alphaStepPerSec = 1;
  let prevTime = performance.now();
  bottomMenu.style.display = 'flex';
  bottomMenu.style.opacity = "0";
  let alpha = 0;
  function easeToOpaque() {
    const now = performance.now();
    const dt = (now - prevTime) * 0.001;
    prevTime = now;
    alpha += dt * alphaStepPerSec;
    if (alpha < 1) {
      bottomMenu.style.opacity = alpha.toString();
      setTimeout(easeToOpaque, easeTimeStep);
    } else {
      bottomMenu.style.opacity = '1';
    }
  }
  setTimeout(easeToOpaque, easeTimeStep);
}


function startApp() {
  console.log('App started');

  const mainCanvas = document.getElementById('main_canvas') as HTMLCanvasElement;

  const rendererMap = new Map<string, RendererInterface>();
  rendererMap.set('space', new SpaceRenderer(mainCanvas));
  rendererMap.set('rain', new RainRenderer(mainCanvas));
  rendererMap.set('flower_falling', new FlowerFallingRenderer(mainCanvas));

  let currentRendererName = 'space';
  // random pick evenly.
  const rendererNames = Array.from(rendererMap.keys());
  currentRendererName = pickWeightedRandom(rendererNames.map(name => [name, 1]));
  console.log('currentRendererName:', currentRendererName);

  const spaceButton = document.getElementById('space_button') as HTMLButtonElement;
  const rainButton = document.getElementById('rain_button') as HTMLButtonElement;
  const flowerFallingButton = document.getElementById('flower_falling_button') as HTMLButtonElement;

  spaceButton.addEventListener('click', () => {
    currentRendererName = 'space';
  });

  rainButton.addEventListener('click', () => {
    currentRendererName = 'rain';
  });

  flowerFallingButton.addEventListener('click', () => {
    currentRendererName = 'flower_falling';
  });

  let prevTimeStamp = performance.now();
  let deltaTimeSec = 0.001;

  function checkMenuToggle(_x: number, _y: number) {
    const bottomMenu = document.getElementById('bottom_menu') as HTMLDivElement;

    // toggle display. If it's block, change to none, and vice versa (easing alpha).
    const display = bottomMenu.style.display;
    if (display === 'flex') {
      hideBottomMenu();
    } else {
      showBottomMenu();
    }
  }

  mainCanvas.addEventListener('touchend', (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      checkMenuToggle(x, y);
    }
  });

  mainCanvas.addEventListener('mouseup', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    checkMenuToggle(x, y);
  });

  let currentRenderer = rendererMap.get(currentRendererName);
  currentRenderer?.start();

  let prevRendererName = currentRendererName;

  // loop to render the game
  function gameLoop() {
    const nowTimeStamp = performance.now();
    deltaTimeSec = (nowTimeStamp - prevTimeStamp) * 0.001;
    prevTimeStamp = nowTimeStamp;

    if (prevRendererName !== currentRendererName) {
      currentRenderer?.stop();
      currentRenderer = rendererMap.get(currentRendererName);
      currentRenderer?.start();
      prevRendererName = currentRendererName;
    }

    currentRenderer = rendererMap.get(currentRendererName);
    currentRenderer?.update(deltaTimeSec);
    currentRenderer?.render();

    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

// when the page is loaded, the script will be executed
document.addEventListener('DOMContentLoaded', () => {
  startApp();
})
