import './style.css';
import { marked } from 'marked';

function startApp() {
  console.log('App started');
  const mainMarkdownContent_e = document.getElementById('main-markdown-content') as HTMLDivElement;
  const mainMarkdownContent = mainMarkdownContent_e.innerHTML;
  console.log(mainMarkdownContent);
  const markdownContent = marked(mainMarkdownContent) as string;
  mainMarkdownContent_e.innerHTML = markdownContent;
}

// when the page is loaded, the script will be executed
document.addEventListener('DOMContentLoaded', () => {
  startApp();
})
