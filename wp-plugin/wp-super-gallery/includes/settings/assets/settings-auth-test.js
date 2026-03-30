(function() {
  function buildAuthFailureMessage(response, responseText, config) {
    var trimmedText = responseText.trim();

    if (trimmedText === '0' || trimmedText === '-1' || response.status === 401 || response.status === 403) {
      return config.authRejectedText;
    }

    if (trimmedText && trimmedText.charAt(0) !== '<') {
      return trimmedText;
    }

    return response.ok ? config.unexpectedResponseText : config.connectionFailedText;
  }

  function parseAuthTestResponse(response, config) {
    return response.text().then(function(responseText) {
      var contentType = response.headers.get('content-type') || '';

      if (contentType.indexOf('application/json') !== -1) {
        try {
          return JSON.parse(responseText);
        } catch (error) {
          return {
            success: false,
            data: {
              message: buildAuthFailureMessage(response, responseText, config),
            },
          };
        }
      }

      return {
        success: false,
        data: {
          message: buildAuthFailureMessage(response, responseText, config),
        },
      };
    });
  }

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
          return parseAuthTestResponse(response, config);
        })
        .then(function(data) {
          testBtn.disabled = false;

          if (data.success) {
            resultSpan.textContent = data.data.message;
            resultSpan.style.color = 'green';
            return;
          }

          resultSpan.textContent = data.data.message || config.connectionFailedText;
          resultSpan.style.color = 'red';
        })
        .catch(function() {
          testBtn.disabled = false;
          resultSpan.textContent = config.requestFailedText;
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