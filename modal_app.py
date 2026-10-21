import modal, subprocess, time, random, threading, requests

app = modal.App("metaluna-foundry")
vol = modal.Volume.from_name("metaluna-models", create_if_missing=True)

image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "cmake", "build-essential")
    .pip_install("fastapi[standard]", "requests", "huggingface_hub")
    .run_commands(
        "git clone --recursive https://github.com/leejet/stable-diffusion.cpp /opt/sd",
        "cd /opt/sd && cmake -B build -DSD_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=75 -DCMAKE_BUILD_TYPE=Release",
        "cd /opt/sd && cmake --build build --config Release -j8",
    )
)

FILES = [
    ("AtomicChat/Qwen-Image-2.1-Turbo-GGUF", "Qwen-Image-2.1-Turbo-AD-Q4_K.gguf"),
    ("AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF", "Qwen-Image-2.1-Turbo-Uncensored-AD-Q4_K.gguf"),
    ("Comfy-Org/Qwen-Image-2.1", "vae/qwen_image_2.1_vae_bf16.safetensors"),
]
SIGMAS = "1.0,0.978453,0.95418,0.926626,0.89508,0.845148,0.704534,0.414568,0.0"
SIZES = {"1:1": (1024, 1024), "4:3": (1152, 864), "3:4": (864, 1152),
         "16:9": (1280, 720), "9:16": (720, 1280)}
SD = "http://127.0.0.1:1234/sdapi/v1/txt2img"


@app.function(image=image, volumes={"/models": vol}, timeout=1800)
def download_models():
    from huggingface_hub import hf_hub_download
    for repo, fname in FILES:
        hf_hub_download(repo, fname, local_dir="/models")
    vol.commit()
    print("models ready")


@app.cls(gpu="T4", image=image, volumes={"/models": vol},
         scaledown_window=90, max_containers=1, timeout=1200)
@modal.concurrent(max_inputs=8)
class Foundry:
    @modal.enter()
    def boot(self):
        self.ready = False
        self.lock = threading.Lock()
        self.proc = subprocess.Popen([
            "/opt/sd/build/bin/sd-server",
            "--diffusion-model", "/models/Qwen-Image-2.1-Turbo-AD-Q4_K.gguf",
            "--llm", "/models/Qwen-Image-2.1-Turbo-Uncensored-AD-Q4_K.gguf",
            "--vae", "/models/vae/qwen_image_2.1_vae_bf16.safetensors",
            "--steps", "8", "--cfg-scale", "1.0", "--sampling-method", "euler",
            "--sigmas", SIGMAS, "--diffusion-fa", "--vae-tiling",
            "--listen-ip", "127.0.0.1", "--listen-port", "1234",
        ])
        t0 = time.time()
        while time.time() - t0 < 300:
            if self.proc.poll() is not None:
                raise RuntimeError("sd-server died during boot")
            try:
                requests.get("http://127.0.0.1:1234/", timeout=2)
                break
            except Exception:
                time.sleep(2)
        r = requests.post(SD, json={"prompt": "a silver sphere", "width": 512,
                                    "height": 512, "seed": 1, "batch_size": 1}, timeout=900)
        self.ready = (r.status_code == 200)

    @modal.asgi_app()
    def web(self):
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import JSONResponse

        api = FastAPI()
        api.add_middleware(CORSMiddleware, allow_origins=["*"],
                           allow_methods=["*"], allow_headers=["*"])

        def as_data_uri(b64):
            if b64.startswith("data:"):
                return b64
            mime = "image/png" if b64.startswith("iVBOR") else "image/jpeg"
            return f"data:{mime};base64,{b64}"

        @api.get("/health")
        def health():
            return {"ok": True, "ready": self.ready}

        @api.post("/generate")
        def generate(body: dict):
            prompt = (body.get("prompt") or "").strip()
            if not prompt:
                return JSONResponse({"error": "Prompt is empty"}, status_code=400)
            count = max(1, min(int(body.get("count", 1)), 4))
            w, h = SIZES.get(body.get("ratio", "1:1"), SIZES["1:1"])
            images, t1 = [], time.time()
            with self.lock:
                for _ in range(count):
                    r = requests.post(SD, json={"prompt": prompt, "width": w, "height": h,
                                                "seed": random.randint(0, 2**31 - 1),
                                                "batch_size": 1}, timeout=900)
                    if r.status_code != 200:
                        return JSONResponse({"error": f"sd-server {r.status_code}: {r.text[:300]}"},
                                            status_code=502)
                    images.append(as_data_uri(r.json()["images"][0]))
            return {"images": images, "width": w, "height": h,
                    "seconds": round(time.time() - t1, 1)}

        return api