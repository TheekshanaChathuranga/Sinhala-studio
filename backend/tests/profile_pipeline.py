import time
import os
import wave
import psutil
import numpy as np
import sys
sys.path.insert(0, ".")
from pathlib import Path
from faster_whisper import WhisperModel
from app.utils.ffmpeg_utils import extract_audio_to_wav, extract_media_metadata
from app.services.segmentation_service import segment_transcription

def load_wav_as_numpy(wav_path: str) -> np.ndarray:
    """Fast, zero-PyAV audio loader directly reading 16kHz 16-bit PCM WAV."""
    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())

        if sampwidth == 2:
            data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        elif sampwidth == 4:
            data = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            data = np.frombuffer(frames, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0

        if n_channels > 1:
            data = data.reshape(-1, n_channels).mean(axis=1)

        return data

def run_profiling():
    print("=" * 70)
    print("SINHALA STUDIO - BASELINE PIPELINE PROFILING & BOTTLENECK ANALYSIS")
    print("=" * 70)

    video_path = r"E:\Ideas\Sinhala Substitle\storage\uploads\0913ded8-50ea-486e-81fb-7e546184380f_da619f71.mp4"
    out_test_wav = r"E:\Ideas\Sinhala Substitle\storage\audio\profile_extracted.wav"

    # Stage 1: Video inspection
    t0 = time.perf_counter()
    meta = extract_media_metadata(video_path)
    t_inspect = time.perf_counter() - t0
    duration = meta.get("duration", 260.33)
    print(f"[Stage 1] Media Inspection: {t_inspect*1000:.2f} ms | Duration: {duration:.2f}s | Size: {meta.get('file_size', 0)/1e6:.1f}MB")

    # Stage 2: Audio extraction via FFmpeg (Cold vs Cached)
    t0 = time.perf_counter()
    extract_audio_to_wav(video_path, out_test_wav)
    t_extract_cold = time.perf_counter() - t0
    print(f"[Stage 2a] FFmpeg Audio Extraction (Cold, full 260.3s): {t_extract_cold:.3f} s (RTF: {t_extract_cold/duration:.4f})")

    # Cached check simulation
    t0 = time.perf_counter()
    if os.path.exists(out_test_wav) and os.path.getsize(out_test_wav) > 0:
        pass
    t_extract_cached = time.perf_counter() - t0
    print(f"[Stage 2b] Audio Extraction (Cached): {t_extract_cached*1000:.4f} ms (Speedup: {t_extract_cold/(t_extract_cached + 1e-9):.0f}x)")

    # Stage 3: Audio loading into float32 numpy array
    t0 = time.perf_counter()
    audio = load_wav_as_numpy(out_test_wav)
    t_load_audio = time.perf_counter() - t0
    print(f"[Stage 3] Fast WAV -> Float32 load: {t_load_audio*1000:.2f} ms | Samples: {len(audio)}")

    # Stage 4: Model loading comparison
    configs = [
        ("tiny", "cpu", "int8"),
    ]

    models = {}
    print("\n--- [Stage 4] Model Loading Times ---")
    for model_name, device, compute in configs:
        t0 = time.perf_counter()
        m = WhisperModel(model_name, device=device, compute_type=compute, local_files_only=True)
        t_load = time.perf_counter() - t0
        models[(model_name, device, compute)] = m
        print(f"  Model {model_name.upper()} on {device.upper()} ({compute}): {t_load:.3f} s")

    # Cached model load simulation
    t0 = time.perf_counter()
    _cached_m = models.get(("tiny", "cpu", "int8"))
    t_cached_load = time.perf_counter() - t0
    print(f"  Model In-Memory Cache Lookup: {t_cached_load*1000:.4f} ms (Instant)")

    # Stage 5: Inference benchmarks on 60-second slice
    slice_sec = 60.0
    slice_audio = audio[:int(16000 * slice_sec)]
    print(f"\n--- [Stage 5] Inference Benchmark on 60.0s Speech Audio (CPU int8) ---")

    benchmark_runs = [
        ("tiny", "cpu", "int8", 5, True, "CPU Standard (beam=5, word_ts=True)"),
        ("tiny", "cpu", "int8", 1, True, "CPU Greedy with Word TS (beam=1, word_ts=True)"),
        ("tiny", "cpu", "int8", 1, False, "CPU Fast Greedy (beam=1, word_ts=False)"),
    ]

    for model_name, device, compute, beam, word_ts, label in benchmark_runs:
        key = (model_name, device, compute)
        if key not in models:
            continue
        m = models[key]
        
        t0 = time.perf_counter()
        segs_gen, info = m.transcribe(
            slice_audio,
            language="si",
            beam_size=beam,
            word_timestamps=word_ts,
            vad_filter=True
        )
        segs = list(segs_gen)
        t_infer = time.perf_counter() - t0
        rtf = t_infer / slice_sec

        print(f"  {label:<46} | Time: {t_infer:5.2f}s | RTF: {rtf:.3f} | Speedup: {slice_sec/t_infer:4.1f}x real-time | Segments: {len(segs)}")

    # Stage 6: Full 260.33s (4.34 min) run on optimal configurations
    print(f"\n--- [Stage 6] Full Audio (260.33s / ~4.34 min) End-to-End Inference ---")
    
    for model_name, device, beam, word_ts, label in [
        ("tiny", "cpu", 5, True, "Full Audio - Standard (beam=5, word_ts=True)"),
        ("tiny", "cpu", 1, False, "Full Audio - Fast Greedy (beam=1, word_ts=False)"),
    ]:
        key = (model_name, device, "int8")
        if key not in models:
            continue
        m = models[key]
        t0 = time.perf_counter()
        segs_gen, info = m.transcribe(
            audio,
            language="si",
            beam_size=beam,
            word_timestamps=word_ts,
            vad_filter=True
        )
        segs = list(segs_gen)
        t_infer = time.perf_counter() - t0
        rtf = t_infer / duration
        print(f"  {label:<46} | Time: {t_infer:5.2f}s | RTF: {rtf:.3f} | Speedup: {duration/t_infer:4.1f}x | Cues: {len(segs)}")

    # Stage 7: Subtitle segmentation
    sample_segments = [
        {"start": s.start, "end": s.end, "text": s.text} for s in segs
    ]
    t0 = time.perf_counter()
    cues = segment_transcription(sample_segments)
    t_seg = time.perf_counter() - t0
    print(f"\n[Stage 7] Subtitle Segmentation ({len(cues)} cues): {t_seg*1000:.3f} ms")

if __name__ == "__main__":
    run_profiling()
