// This plugin will send selected elements to the provided URL as json data

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);

figma.ui.resize(500, 500);

interface SubmitData  {
  eventType: string;
  fileKey: string | undefined;  
  nodeIds: Array<string>;
}

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.

figma.ui.onmessage = async(pluginMessage: {type: string, targetUrl: string, targetToken: string}) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (pluginMessage.type === 'submit-current-selection') {
    const nodes = figma.currentPage.selection;
    if (nodes.length === 0) {
      figma.closePlugin('Please select at least one element');
    }

    let nodeIds: Array<string> = [];
    
    for (const node of nodes) {
      nodeIds.push(node.id);
    }

    let data:SubmitData = {
      eventType: pluginMessage.type,
      fileKey: figma.fileKey,
      nodeIds: nodeIds
    };

    const url = pluginMessage.targetUrl;
    const token = pluginMessage.targetToken;
  
    await postData(url, token, data);
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin('Data sent successfully');
};

async function postData(url: string, token: string, data:SubmitData) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${token}`, // Provide the token
        'Content-Type': 'application/json', // Indicate JSON payload
      },
      body: JSON.stringify(data), // Convert the JavaScript object to JSON
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (response.headersObject['content-type'].includes('application/json')) {
      const result = await response.json();
      console.log('Response:', result);
      return result;
    }
  } catch (error) {
    console.error('Error:', error);
  }
}