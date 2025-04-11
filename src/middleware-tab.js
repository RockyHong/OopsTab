// This file contains the JavaScript for middleware-tab.html
// Having it in a separate file helps avoid Content Security Policy issues

document.addEventListener('DOMContentLoaded', function() {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get('url');
  const pageTitle = urlParams.get('title');
  const faviconUrl = urlParams.get('favicon');
  const oopsTabData = urlParams.get('tabdata');
  
  // Set page elements
  if (pageTitle) {
    document.title = pageTitle;
    document.getElementById('title').textContent = pageTitle;
  } else {
    document.title = 'Suspended Tab';
    document.getElementById('title').textContent = 'Suspended Tab';
  }
  
  document.getElementById('url').textContent = targetUrl || '';
  
  // Set favicon for the page and the favicon image
  if (faviconUrl) {
    // Set favicon for the page
    const linkIcon = document.createElement('link');
    linkIcon.rel = 'icon';
    linkIcon.href = faviconUrl;
    document.head.appendChild(linkIcon);
    
    // Set favicon image in the content
    const faviconElement = document.getElementById('favicon');
    faviconElement.src = faviconUrl;
    faviconElement.onerror = function() {
      // If favicon fails to load, hide it
      this.style.display = 'none';
    };
  } else {
    document.getElementById('favicon').style.display = 'none';
  }
  
  // Function to navigate to the actual page
  function loadTargetPage() {
    if (targetUrl) {
      document.getElementById('loading').style.display = 'block';
      window.location.href = targetUrl;
    }
  }

  // Listen for visibility changes - load the actual page when tab becomes active
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && targetUrl) {
      loadTargetPage();
    }
  });

  // Also check on load if already visible (tab was directly activated)
  if (document.visibilityState === 'visible' && targetUrl) {
    // Add a small delay to ensure the middleware page renders first
    setTimeout(() => {
      loadTargetPage();
    }, 50);
  }
}); 