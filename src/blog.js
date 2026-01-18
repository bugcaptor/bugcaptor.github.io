document.addEventListener('DOMContentLoaded', () => {
    startBlogFormatting();
});

function startBlogFormatting() {
    // find pre element
    const blogHtmls = [];

    const preElements = document.querySelectorAll('pre');
    preElements.forEach(pre => {
        // extract the text content
        const textContent = pre.textContent;
        // convert to HTML
        const htmlContent = markdownToHtml(textContent);

        blogHtmls.push(htmlContent);
    });

    // remove all pre elements
    preElements.forEach(pre => {
        pre.parentNode.removeChild(pre);
    });


    const rootDiv = document.createElement('div');

    // Add back-to-blog link if not on the main blog page
    const currentPath = window.location.pathname;
    const isBlogIndex = currentPath.endsWith('/blog/') || currentPath.endsWith('/blog/index.html');

    if (!isBlogIndex) {
        const backLink = document.createElement('div');
        backLink.className = 'back-to-blog';
        backLink.innerHTML = '<a href="/blog/index.html">← 블로그로 돌아가기</a>';
        rootDiv.appendChild(backLink);
    }

    // add blog posts.
    blogHtmls.forEach(html => {
        const div = document.createElement('div');
        div.className = 'blog-post';
        div.innerHTML = html;
        rootDiv.appendChild(div);
    });

    // add to the body
    document.body.appendChild(rootDiv);

}

function markdownToHtml(markdown) {
    let html = marked.parse(markdown);
    return html.trim();
}
