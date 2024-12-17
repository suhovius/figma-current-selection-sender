// This plugin will send selected elements to the provided URL as json data

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);

figma.ui.resize(500, 500);

interface ImageDatum {
  id: string;
  name: string;
  contentType: string;
  base64Image: string;
}

interface SubmitData  {
  eventType: string;
  fileKey: string | undefined;
  imageData: Array<ImageDatum>;
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

    let imageData: Array<ImageDatum> = [];

    for (const node of nodes) {
      let imageDatum = await processImage(node);
      if (imageDatum !== undefined) {
        imageData.push(imageDatum)
      } else {
        figma.closePlugin('ImageDatum not found');
      }
    }

    let data:SubmitData = {
      eventType: pluginMessage.type,
      fileKey: figma.fileKey,
      imageData: imageData
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
    console.error('Error: ', error);
    figma.closePlugin('Sorry, something went wrong!');
  }
}

async function processImage(node: any) {
  console.log("Selected Node:", node);

  if (node.fills && Array.isArray(node.fills)) {
      const fill = node.fills[0];

      if (!fill) {
        figma.notify("Selected node does not contain image fills.");
        return;
      }

      if (fill.type === "IMAGE" && fill.imageHash) {
          try {
              const image = figma.getImageByHash(fill.imageHash)

              if (!image) {
                figma.notify("Image not found.");
                return;
              }

              // Get image bytes
              const imageBytes = await image.getBytesAsync();

              // Determine content type
              const contentType = getImageContentType(imageBytes);
              if (!contentType) {
                  figma.notify("Unknown image type.");
                  return;
              }
              // Convert to Base64
              const base64String = arrayBufferToBase64(imageBytes);
              // Send or use the Base64 string

              let iamgeData:ImageDatum = {
                id: node.id,
                name: node.name,
                contentType: contentType,
                base64Image: base64String
              }

              return iamgeData
          } catch (error) {
              console.error("Error reading image:", error);
          }
      } else {
          figma.notify("Selected rectangle does not contain an image fill.");
      }
  } else {
      figma.notify("Selected rectangle does not contain fills.");
  }
}

function getImageContentType(bytes: ArrayBuffer): string | null {
  const header = new Uint8Array(bytes).subarray(0, 4); // First 4 bytes
  const hexHeader = Array.from(header)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  // Match against known magic numbers
  if (hexHeader.startsWith("89504e47")) {
      return "image/png";
  } else if (hexHeader.startsWith("ffd8")) {
      return "image/jpeg";
  } else if (hexHeader.startsWith("474946")) {
      return "image/gif";
  }
  return null; // Unknown type
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  return figma.base64Encode(bytes)
}