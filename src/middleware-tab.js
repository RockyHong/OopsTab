// This file contains the JavaScript for middleware-tab.html
// Having it in a separate file helps avoid Content Security Policy issues

document.addEventListener('DOMContentLoaded', function() {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get('url');
  const pageTitle = urlParams.get('title');
  const faviconUrl = urlParams.get('favicon');
  
  // Set page title
  if (pageTitle) {
    document.title = pageTitle;
  }
  
  // Set favicon for the page
  if (faviconUrl) {
    const linkIcon = document.createElement('link');
    linkIcon.rel = 'icon';
    linkIcon.href = faviconUrl;
    document.head.appendChild(linkIcon);
  }
  
  // Function to navigate to the actual page
  function loadTargetPage() {
    if (targetUrl) {
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