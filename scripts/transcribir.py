"""Transcribe las notas de voz (.ogg) de la visita con faster-whisper.

Uso: python scripts/transcribir.py <carpeta_ogg> docs/transcripciones [archivo.ogg ...]
Modelo: variable WM (por defecto large-v3, el más preciso).
"""
import os, sys, time, pathlib
from faster_whisper import WhisperModel

src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
only = sys.argv[3:]  # nombres opcionales a procesar
dst.mkdir(parents=True, exist_ok=True)

PROMPT = ("Reunión de la Hackathon de la Fundación Santo Domingo sobre el barrio Villa San Pablo, "
          "Barranquilla. Residuos orgánicos, reciclaje, recicladores, compostaje, aprovechamiento, "
          "clasificación en la fuente, coordinador, stakeholders, aplicativo.")

T=time.time(); model = WhisperModel(os.environ.get("WM","large-v3"), device="auto", compute_type="auto", cpu_threads=4); print(f"carga {time.time()-T:.0f}s", flush=True)

for f in sorted(src.glob("*.ogg"), key=lambda p: p.stat().st_size):
    if only and f.name not in only:
        continue
    out = dst / (f.stem.replace("WhatsApp Ptt ", "").replace(" ", "_") + ".txt")
    if out.exists():
        continue
    t0 = time.time()
    segs, info = model.transcribe(str(f), language="es", beam_size=5, vad_filter=True,
                                  vad_parameters={"min_silence_duration_ms": 700},
                                  initial_prompt=PROMPT, condition_on_previous_text=False)
    lines = [f"[{int(s.start)//60:02d}:{int(s.start)%60:02d}] {s.text.strip()}" for s in segs]
    out.write_text(f"# {f.name} ({info.duration:.0f}s)\n\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"OK {f.name}: {info.duration:.0f}s audio en {time.time()-t0:.0f}s", flush=True)
