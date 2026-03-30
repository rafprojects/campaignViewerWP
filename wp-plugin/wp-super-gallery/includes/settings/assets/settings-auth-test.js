(function() {
  function initAuthTestButton() {
    var testBtn = document.getElementById('wpsg-test-auth');
    var resultSpan = document.getElementById('wpsg-test-auth-result');
    var config = window.wpsgSettingsAuthTest;

    if (!testBtn || !resultSpan || !config) {
      return;
    }

    if (testBtn.dataset.wpsgBound === 'true') {
      return;
    }
    testBtn.dataset.wpsgBound = 'true';

    testBtn.addEventListener('click', function() {
      testBtn.disabled = true;
      resultSpan.textContent = config.testingText;
      resultSpan.style.color = '';

      fetch(config.ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'wpsg_test_auth',
          _ajax_nonce: config.nonce,
        }),
      })
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          testBtn.disabled = false;

          if (data.success) {
            resultSpan.textContent = '✓ ' + data.data.message;
            resultSpan.style.color = 'green';
            return;
          }

          resultSpan.textContent = '✗ ' + (data.data.message || config.connectionFailedText);
          resultSpan.style.color = 'red';
        })
        .catch(function() {
          testBtn.disabled = false;
          resultSpan.textContent = '✗ ' + config.requestFailedText;
          resultSpan.style.color = 'red';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthTestButton);
  } else {
    initAuthTestButton();
  }
})();