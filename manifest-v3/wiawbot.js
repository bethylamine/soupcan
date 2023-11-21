var browser = browser || chrome;

document.addEventListener('DOMContentLoaded', function() {
  var state = null;

  browser.storage.local.get(["state"], v => {
  
    if (v.state) {
      state = v.state;
    }
  });

  var sendButton = document.getElementById('sendButton');
  var messageInput = document.getElementById('messageInput');
  var chatMessages = document.getElementById('chatMessages');
  var thread = "";
  var invocations_left = 0;

  function appendMessage(text, sender, loading = false) {
    var messageContainer = document.createElement('div');
    messageContainer.className = sender ? 'message-container sender' : 'message-container receiver';
  
    var avatar = document.createElement('img');
    avatar.src = sender ? 'sender-avatar.png' : 'receiver-avatar.png';
    avatar.className = 'avatar';
  
    var textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    if (loading) {
      var spinnerImg = document.createElement('img');
      spinnerImg.src = "spinner.gif";
      textDiv.appendChild(spinnerImg);
    } else {
      // Parse Markdown and sanitize
      textDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
    }
  
    if (sender) {
      messageContainer.appendChild(textDiv);
      messageContainer.appendChild(avatar);
    } else {
      messageContainer.appendChild(avatar);
      messageContainer.appendChild(textDiv);
    }

    if (loading) {
      messageContainer.id = "loadingMessage";
    }

    chatMessages.appendChild(messageContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
  }
  
  messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevents the default action of the enter key in a form
      sendMessage();
    }
  });

  sendButton.addEventListener('click', function() {
    sendMessage();
  });

  function sendMessage() {
    var message = messageInput.value;

    // Check if the message is not empty
    if (message.trim() !== '') {
      // Append the sent message
      appendMessage(message, true);
      // Append the loading message
      appendMessage("", false, true);
        
      fetch('https://api.beth.lgbt/chat?state=' + state + "&thread=" + thread, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message })
      })
      .then(response => response.json())
      .then(data => {
        // Hide loading spinner
        document.getElementById('loadingMessage').remove();

        // Save the thread value
        thread = data.thread;
        // Save the number of invocations left
        invocations_left = data.invocations_left;
        // Append the received message
        appendMessage(data.message, false);
      })
      .catch((error) => {
        console.error('Error:', error);

        // Hide loading spinner
        document.getElementById('loadingMessage').remove();
      });

      // Clear the input field
      messageInput.value = '';
    }
  }
});