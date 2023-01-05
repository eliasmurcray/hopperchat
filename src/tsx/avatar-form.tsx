import React from "react";

function dataURItoBlob(dataURI) {
  var byteString = atob(dataURI.split(",")[1]);
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }
  var blob = new Blob([ab], {type: mimeString});
  return blob;
}

function hideElement(element: HTMLElement) {
  element.addEventListener("animationend", callback);
  element.style.animation = "fade-out 1s ease-in-out";
  function callback() {
    element.removeEventListener("animationend", callback);
    element.style.display = "none";
    element.style.animation = "none";
  }
}

class AvatarForm extends React.Component<{ onSuccess: (file: File) => void }> {
  private canvasRef: React.RefObject<HTMLCanvasElement>;
  private liquidRef: React.RefObject<HTMLDivElement>;
  private fileInputRef: React.RefObject<HTMLInputElement>;
  private submitRef: React.RefObject<HTMLButtonElement>;
  private bottleRef: React.RefObject<HTMLDivElement>;
  private file: File;

  constructor(props: { onSuccess: () => void; } | Readonly<{ onSuccess: () => void; }>) {
    super(props);
    this.canvasRef = React.createRef();
    this.liquidRef = React.createRef();
    this.fileInputRef = React.createRef();
    this.submitRef = React.createRef();
    this.bottleRef = React.createRef();
    this.handleChange = this.handleChange.bind(this);
    this.resizeFile = this.resizeFile.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.file = null;
  }

  handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(this.submitRef.current.disabled) return;
    if(!this.file) return console.error("No file provided by client.");
    this.props.onSuccess(this.file);
  }

  async handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if(!event.target.files[0]) return;
    this.submitRef.current.disabled = true;
    this.bottleRef.current.style.display = "block";
    this.liquidRef.current.style.transform = "translateY(250px)";
    this.canvasRef.current.style.visibility = "hidden";

    this.resizeFile(event.target.files[0], 1024 * 10, 
    (progress) => {
      this.liquidRef.current.style.transform = `translateY(${progress / 100 * 130 - 10}px)`;
    })
    .then(async (result: BlobPart) => {
      this.file = new File([result], 'result', { 'type': 'image/webp' });
      this.canvasRef.current.style.visibility = "visible";
      this.submitRef.current.disabled = false;
      hideElement(this.bottleRef.current);
    });
  }

  resizeFile(file: File, byte_size: number, progress:(percent: number)=>void=()=>{}) {
    return new Promise((resolve, reject) => {
      const canvas = this.canvasRef.current;
      const ctx = canvas.getContext("2d");
      const blob_url = URL.createObjectURL(file);
      const { width, height } = canvas;
      const diff = file.size - byte_size;
      ctx.fillStyle = "#fff";
      const image = new Image;
      image.onload = async () => {
        const w = image.naturalWidth;
        const h = image.naturalHeight
        const scale = Math.max(width / w, height / h);
        ctx.setTransform(scale, 0, 0, scale, width / 2, height / 2);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.drawImage(image, -w / 2, -h / 2, w, h);
        loop(100);
        function loop(iter: number) {
          const data_url = canvas.toDataURL("image/jpeg", iter / 100);
          const blob = dataURItoBlob(data_url);
          if(blob.size < byte_size) return resolve(blob);
          if(iter < 1) return reject("File is too big.");
          progress(1 - (blob.size - byte_size) / diff);
          loop(iter - 1);
        }
      };
      image.src = blob_url;
    });
  }

  render() {
    return <form action="#" autoComplete="off" onSubmit={this.handleSubmit}>
      <div className="canvas-container">
        <canvas ref={this.canvasRef} onClick={() => this.fileInputRef.current.click()} width="128" height="128"></canvas>
        <div ref={this.bottleRef}>
          <div ref={this.liquidRef}>
            <svg width="500" height="500" viewBox="0 0 300 300">
              <path fill="#0e62d0" d="M300,300V2.5c0,0-0.6-0.1-1.1-0.1c0,0-25.5-2.3-40.5-2.4c-15,0-40.6,2.4-40.6,2.4c-12.3,1.1-30.3,1.8-31.9,1.9c-2-0.1-19.7-0.8-32-1.9c0,0-25.8-2.3-40.8-2.4c-15,0-40.8,2.4-40.8,2.4c-12.3,1.1-30.4,1.8-32,1.9c-2-0.1-20-0.8-32.2-1.9c0,0-3.1-0.3-8.1-0.7V300H300z"></path>
            </svg>
          </div>
        </div>
      </div>
      <button className="file-input-button" onClick={() => this.fileInputRef.current.click()}>
        <img src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='24' height='24'%3E%3Cpath fill='%23fff' d='M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48z'/%3E%3C/svg%3E" />
        Choose File
        <input ref={this.fileInputRef} onChange={this.handleChange} type="file" accept="image/*" hidden />
      </button>
      <button type="submit" ref={this.submitRef} disabled>Create Account</button>
    </form>
  }
}

export default AvatarForm;