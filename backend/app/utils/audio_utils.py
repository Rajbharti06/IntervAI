import speech_recognition as sr
from gtts import gTTS
import io

def transcribe_audio(audio_data):
    r = sr.Recognizer()
    try:
        text = r.recognize_google(audio_data)
        return text
    except sr.UnknownValueError:
        return "Could not understand audio"
    except sr.RequestError as e:
        return f"Speech recognition service error: {e}"

def text_to_speech(text):
    tts = gTTS(text=text, lang='en')
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    fp.seek(0)
    return fp.read()