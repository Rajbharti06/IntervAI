import React, { useState, useRef } from 'react';

import { API_BASE } from '../config';

export default function MicButton({ onTranscript, provider, sessionId, disabled = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);

  const stopMediaStream = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      stopMediaStream();
      stopRecognition();
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // Start recording
    setIsRecording(true);
    setIsLoading(false);

    try {
      if (provider === 'openai') {
        // Use OpenAI backend transcription
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorderRef.current.stream = stream;

        const audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          setIsLoading(true);
          try {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.wav');
            formData.append('session_id', sessionId);

            const response = await fetch(API_BASE + '/interview/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              const data = await response.json();
              if (data.text && data.text.trim()) {
                onTranscript(data.text.trim());
              } else {
                console.warn('No transcription text received');
              }
            } else {
              console.error('Transcription failed:', response.status, response.statusText);
              // Fallback to browser speech recognition if available
              if (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window)) {
                console.log('Falling back to browser speech recognition');
                // Could implement fallback here
              }
            }
          } catch (error) {
            console.error('Error during transcription:', error);
          } finally {
            setIsLoading(false);
            setIsRecording(false);
          }
        };

        mediaRecorder.start();
      } else {
        // Use browser Speech Recognition API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          alert('Speech recognition not supported in this browser');
          setIsRecording(false);
          return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (transcript && transcript.trim()) {
            onTranscript(transcript.trim());
          }
          setIsRecording(false);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          
          // Provide specific error messages based on error type
          let errorMessage = 'Speech recognition failed. ';
          switch (event.error) {
            case 'network':
              errorMessage += 'Please check your internet connection and try again.';
              break;
            case 'not-allowed':
              errorMessage += 'Microphone access denied. Please allow microphone permissions.';
              break;
            case 'no-speech':
              errorMessage += 'No speech detected. Please try speaking again.';
              break;
            case 'audio-capture':
              errorMessage += 'Microphone not available. Please check your audio settings.';
              break;
            case 'service-not-allowed':
              errorMessage += 'Speech recognition service not available.';
              break;
            default:
              errorMessage += 'Please try again or use text input.';
          }
          
          // Show error to user (you might want to pass this up to parent component)
          if (onTranscript) {
            // For now, we'll just log it. In a real app, you'd want better error handling
            console.warn('Speech recognition error for user:', errorMessage);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsRecording(false);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const isDisabled = disabled || (provider !== 'openai' && !('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window));

  return (
    <div className="relative">
      <button
        onClick={handleMicClick}
        disabled={isDisabled || isLoading}
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 transform
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-lg shadow-red-200' 
            : isDisabled 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 shadow-md hover:shadow-lg'
          }
          ${isLoading ? 'animate-pulse' : ''}
        `}
        title={
          isDisabled 
            ? 'Voice input not available' 
            : isRecording 
              ? 'Click to stop recording' 
              : 'Click to start voice input'
        }
      >
        {/* Microphone Icon */}
        <svg 
          className={`w-5 h-5 transition-colors duration-200 ${
            isRecording ? 'text-white' : isDisabled ? 'text-gray-500' : 'text-white'
          }`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
          />
        </svg>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse">
            <div className="absolute inset-0 bg-red-400 rounded-full animate-ping"></div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-blue-600 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </button>

      {/* Recording Status Text */}
      {isRecording && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Recording...
          </div>
        </div>
      )}

      {/* Loading Status Text */}
      {isLoading && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></div>
            Processing...
          </div>
        </div>
      )}
    </div>
  );
}


