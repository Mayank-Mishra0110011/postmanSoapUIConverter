const fs = require("fs");
const crypto = require("crypto");

if (process.argv.length < 3) {
  console.log(
    "Error:",
    "Specify the source file path of the Postman collection JSON to be converted"
  );
} else if (process.argv.length < 4) {
  console.log(
    "Error:",
    "Specify the target file path of the SOAP UI project XML to be created"
  );
} else {
  fs.readFile(process.argv[2], (err, data) => {
    if (err) {
      console.log("Error reading file:", err);
    } else {
      const inputJSON = JSON.parse(data.toString());
      const SOAPXMLString = buildSOAPXML(inputJSON.info.name, inputJSON.item);

      fs.writeFile(process.argv[3], SOAPXMLString, (err) => {
        if (err) {
          console.log("Error writing to file:", err);
        } else {
          console.log(
            "SOAP UI project XML generated successfully at:",
            process.argv[3]
          );
        }
      });
    }
  });
}

function generateUUID() {
  if (!crypto || !crypto.randomUUID) {
    console.log("Crypto API not available.");
    return null;
  }
  return crypto.randomUUID();
}

function buildSOAPXML(name, items) {
  let itemSOAPXML = "";

  items.forEach((obj) => {
    itemSOAPXML += itemJSONtoSOAPXML(obj) + "\n";
  });

  return `<con:soapui-project id="${generateUUID()}" activeEnvironment="Default" name="${name}" resourceRoot="" soapui-version="5.7.2" xmlns:con="http://eviware.com/soapui/config">
  <con:settings/>${itemSOAPXML}<con:properties/>
  <con:wssContainer/>
  <con:oAuth2ProfileContainer/>
  <con:oAuth1ProfileContainer/>
  <con:sensitiveInformation/>
</con:soapui-project>`;
}

function itemJSONtoSOAPXML(item) {
  if (item.item && Array.isArray(item.item) && item.item.length > 0) {
    let subItemsXML = "";
    parentItem = item;
    item.item.forEach((subItem) => {
      subItemsXML += itemJSONtoSOAPXML(subItem);
    });
    return subItemsXML;
  } else if (item.request && item.request.url) {
    let headers = [];
    if (item.request.header) {
      headers = item.request.header.map((h) => {
        return { key: h.key, value: h.value };
      });
    }
    let preRequestScriptHeaders = [];
    if (parentItem.event) {
      parentItem.event.forEach((event) => {
        if (event.listen === "prerequest" && event.script) {
          const scriptHeaders = getScriptHeaders(event.script.exec.join("\n"));
          scriptHeaders.forEach((header) => {
            preRequestScriptHeaders.push(header);
          });
        }
      });
      if (preRequestScriptHeaders.length > 0) {
        headers.forEach((hdr) => {
          if (!preRequestScriptHeaders.some((i) => i.key == hdr.key)) {
            preRequestScriptHeaders.push(hdr);
          }
        });
      }
    }
    if (preRequestScriptHeaders.length == 0) {
      preRequestScriptHeaders = headers;
    }
    preRequestScriptHeaders = preRequestScriptHeaders
      .map((h) => `&lt;con:entry key="${h.key}" value="${h.value}"/>`)
      .join("\n");
    if (preRequestScriptHeaders.trim().length > 1)
      preRequestScriptHeaders = `&lt;xml-fragment xmlns:con="http://eviware.com/soapui/config">\n${preRequestScriptHeaders}&lt;/xml-fragment>`;
    return `<con:interface xsi:type="con:RestService" id="${generateUUID()}" wadlVersion="http://wadl.dev.java.net/2009/02" name="${
      item.name
    }" type="rest" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <con:settings/>
  <con:definitionCache/>
  <con:endpoints>
      <con:endpoint>https://${item.request.url.host.join(".")}</con:endpoint>
  </con:endpoints>
  <con:resource name="${item.name}" path="/${item.request.url.path.join(
      "/"
    )}" id="${generateUUID()}">
      <con:settings/>
      <con:parameters/>
      <con:method name="${
        item.request.url.path[item.request.url.path.length - 1]
      } 1" id="${generateUUID()}" method="${item.request.method}">
          <con:settings/>
          <con:parameters/>
          <con:request name="Request 1" id="${generateUUID()}" mediaType="${
      item.request.body.options.raw.language == "json"
        ? "application/json"
        : "application/xml"
    }" postQueryString="false">
              <con:settings>
                  <con:setting id="com.eviware.soapui.impl.wsdl.WsdlRequest@request-headers">${preRequestScriptHeaders}</con:setting>
          </con:settings>
          <con:endpoint>https://${item.request.url.host.join(
            "."
          )}</con:endpoint>
          <con:request>${
            item.request.body.options.raw.language == "json"
              ? item.request.body.raw
              : `<![CDATA[${item.request.body.raw}]]>`
          }</con:request>
          <con:credentials>
              <con:authType>No Authorization</con:authType>
          </con:credentials>
          <con:jmsConfig JMSDeliveryMode="PERSISTENT"/>
          <con:jmsPropertyConfig/>
          <con:parameters/>
      </con:request>
  </con:method>
</con:resource>
</con:interface>`;
  }
  return "";
}

function getScriptHeaders(scriptString) {
  const headers = [];
  const regex = /key:\s*"([^"]+)",\s*value:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(scriptString)) !== null) {
    const key = match[1];
    const value = match[2];
    headers.push({ key, value });
  }
  return headers;
}
