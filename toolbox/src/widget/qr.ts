import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "toolbox-qr", version: "0.1.0" });
const root = document.getElementById("root")!;

type Block = { type: string; text?: string; data?: string; mimeType?: string };

app.ontoolresult = (result) => {
  const blocks = (result.content ?? []) as Block[];
  const img = blocks.find((b) => b.type === "image" && b.data);
  if (result.isError || !img) {
    root.textContent = blocks.find((b) => b.type === "text")?.text ?? "Could not create the QR code.";
    return;
  }
  const src = `data:${img.mimeType ?? "image/png"};base64,${img.data}`;
  const label = (result.structuredContent as { text?: string } | undefined)?.text ?? "";

  const image = document.createElement("img");
  image.src = src;
  image.alt = `QR code for ${label}`;
  const caption = document.createElement("p");
  caption.textContent = label; // textContent, never innerHTML: the label is user-controlled
  const dl = document.createElement("a");
  dl.href = src;
  dl.download = "qr-code.png";
  dl.textContent = "Download PNG";

  root.replaceChildren(image, caption, dl);
};

app.connect();
