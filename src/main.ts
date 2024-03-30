import './style.css';
import { Space } from './space';

function startApp() {
  console.log('App started');

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const space = new Space(canvas);

  let prevTimeStamp = performance.now();
  let deltaTimeSec = 0.001;

  let rotateYaw = 0;
  let rotatePitch = 0;
  const rotateMax = Math.PI / 3;
  const rotateAmount = Math.PI / 4;
  let rotateYawPushed = false;
  let pitchUpPushed = false;
  let pitchDownPushed = false;

  function checkRotateDown(x: number, y: number, pushOrNot: boolean) {
    if (y > canvas.height * 0.8 &&
      x > canvas.width * 0.2 &&
      x < canvas.width * 0.8) {
      pitchDownPushed = pushOrNot;
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    // if touch on canvas bottom?
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      checkRotateDown(touch.clientX, touch.clientY, true);
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    checkRotateDown(e.clientX, e.clientY, true);
  });

  canvas.addEventListener('touchmove', (e) => {
  });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      checkRotateDown(touch.clientX, touch.clientY, false);
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    checkRotateDown(e.clientX, e.clientY, false);
  });

  space.start();
  // loop to render the game
  function gameLoop() {
    const nowTimeStamp = performance.now();
    deltaTimeSec = (nowTimeStamp - prevTimeStamp) * 0.001;
    prevTimeStamp = nowTimeStamp;

    if (pitchUpPushed) {
      rotatePitch = Math.min(rotatePitch + rotateAmount * deltaTimeSec, rotateMax);
    } else if (pitchDownPushed) {
      rotatePitch = Math.max(rotatePitch - rotateAmount * deltaTimeSec, -rotateMax);
    } else {
      rotatePitch *= 0.5 * deltaTimeSec;
    }

    space.setFlowDirection(rotateYaw, rotatePitch);
    space.flowStars(deltaTimeSec);

    space.render();
    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

// when the page is loaded, the script will be executed
document.addEventListener('DOMContentLoaded', () => {
  startApp();
})
