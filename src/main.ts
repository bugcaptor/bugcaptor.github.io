import './style.css';
import { Space } from './space';

function startApp() {
  console.log('App started');

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const space = new Space(canvas);

  space.start();
  // loop to render the game
  function gameLoop() {
    space.render();
    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

// when the page is loaded, the script will be executed
document.addEventListener('DOMContentLoaded', () => {
  startApp();
})
