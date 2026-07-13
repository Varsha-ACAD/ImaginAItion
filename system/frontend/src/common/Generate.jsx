import { useEffect, useState, useRef } from 'react';
import backgroundImage from '../assets/background.png';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import sio from './websocket';
import { getImageUrl } from '../config/api';
import {
  CircleSpinner,
  StageSpinner,
  FireworkSpinner,
  MetroSpinner,
} from 'react-spinners-kit';
import socket from './websocket';
import Waiting from './Waiting';
import { encoding_for_model } from 'tiktoken';

// OpenAI tiktoken count matching the backend `calculate_prompt_tokens`
function calculatePromptTokens(prompt) {
  if (!prompt) return 0;
  const trimmed = String(prompt).trim();
  if (!trimmed) return 0;
  // special handling for the placeholder hint
  if (trimmed === "No prompt submitted") return 0;
  
  // Use GPT-4o encoding for accurate tokenization
  const encoding = encoding_for_model("gpt-4o");
  const tokens = encoding.encode(trimmed);
  return tokens.length;
}

export default function Generate({ currentTurn, gameStarted: gameStartedProp, onHasGeneratedChange, onIsGeneratingChange }) {
  const [input, setInput] = useState('');
  const [showConfirmView, setShowConfirmView] = useState(false);
  const [sentence, setSentence] = useState('');
  const { gameCode } = useParams();
  const [image, setImage] = useState('');
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [confirmImage, setConfirmImage] = useState('');
  const [prompt, setPrompt] = useState('');

  // new: reference-image state
  const [referenceImage, setReferenceImage] = useState(null);
  const [isLoadingReference, setIsLoadingReference] = useState(true);

  // Use prop value if provided, otherwise maintain local state for backwards compatibility
  const gameStarted = gameStartedProp !== undefined ? gameStartedProp : false;
  
  // generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [tokenCount, setTokenCount] = useState(0);
  
  // content-moderation failure state
  const [showModerationError, setShowModerationError] = useState(false);
  
  // use a ref to read the latest input value for auto-submit
  const inputRef = useRef('');

  // sync the ref on input change, but debounce the token count
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // debounced token counting to keep typing smooth
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTokenCount(calculatePromptTokens(input));
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [input]);

  // Game start is now managed by parent PlayGame component via props

  // reset the waiting state when the round changes
  const lastResetTurn = useRef(-1);
  
  useEffect(() => {
    console.log("🔄 Generate: currentTurn changed to", currentTurn, "gameStarted:", gameStarted);

    // reset the waiting state when entering a new image-generation round
    if (currentTurn % 4 === 0 && lastResetTurn.current !== currentTurn) {
      console.log("🆕 Generate: Resetting waiting state for new image generation turn");
      lastResetTurn.current = currentTurn;
      setWaitingForPlayers(false);
      setHasGenerated(false);
      onHasGeneratedChange?.(false);
      setIsGenerating(false);
      onIsGeneratingChange?.(false);
      setInput('');
      setPrompt('');
      setGeneratedImages([]);
      setShowModerationError(false);
    }
  }, [currentTurn, gameStarted]);

  // only fetch the reference image after the game starts
  useEffect(() => {
    if (!gameStarted) {
      setIsLoadingReference(false); // do not show the loading state before the game starts
      return;
    }
    
    const fetchReferenceImage = async () => {
      // ensure the socket connection is established and has an ID
      if (!sio.id || !sio.connected) {
        console.log('Socket not ready, waiting...', { id: sio.id, connected: sio.connected });
        setTimeout(fetchReferenceImage, 200);
        return;
      }
      
      try {
        setIsLoadingReference(true);
        console.log('Game started! Fetching reference image for room:', gameCode, 'sid:', sio.id);
        const response = await axios.get(`/api/reference-image?room_id=${gameCode}&sid=${sio.id}`);
        console.log('Reference image response:', response.data);
        setReferenceImage(response.data);
      } catch (error) {
        console.error('Error fetching reference image:', error);
        // if it failed due to a sid issue, retry later
        if (error.response?.data?.error?.includes('Socket ID')) {
          setTimeout(fetchReferenceImage, 500);
        }
      } finally {
        setIsLoadingReference(false);
      }
    };
    
    fetchReferenceImage();
  }, [gameStarted, gameCode]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || hasGenerated) return;

    setIsGenerating(true);
    onIsGeneratingChange?.(true);
    setPrompt(input.trim());

    try {
      await axios.post('/api/generate-images', {
        prompt: input.trim(),
        room_id: gameCode,
        sid: sio.id,
      });

      const response = await axios.get(
        `/api/get-images?room_id=${gameCode}&sid=${sio.id}`
      );

      // take only the first image
      const firstImage = response.data.images[0];
      setGeneratedImages([firstImage]);
      setImage(firstImage);
      setHasGenerated(true);
      onHasGeneratedChange?.(true);
      console.log("✅ Manual submit successful, hasGenerated set to true");
      
      // auto-confirm
      await handleSendImage(firstImage, input.trim());
      await handlePlayerDone();
      await socket.emit('get-player-state', { room_id: gameCode });
      // no need to set waitingForPlayers; the status bar under the image already shows the waiting state
    } catch (error) {
      console.error('Error generating images:', error);

      // Check if it's a content moderation error
      if (error.response?.status === 400 && error.response?.data?.detail?.error === 'content_moderation_blocked') {
        // Show moderation error modal
        setShowModerationError(true);
      }
      // Check if it's an API key error
      else if (error.response?.status === 401 && error.response?.data?.detail?.error === 'invalid_api_key') {
        alert('Invalid OpenAI API key. Please check your API key and try again.');
      }
      // Check for other errors
      else {
        alert(`Image generation failed: ${error.response?.data?.detail?.message || error.message}`);
      }
    } finally {
      setIsGenerating(false);
      onIsGeneratingChange?.(false);
    }
  };

  const handlePlayerDone = async () => {
    await sio.emit('player-done', {
      room_id: gameCode,
      sid: sio.id,
    });
  };
  const handleSendImage = async (imageUrl, promptText) => {
    await axios.post('/api/submit-image', {
      sid: sio.id,
      room_id: gameCode,
      image_url: imageUrl || image,
      prompt: promptText || prompt,
    });
  };
  const handleConfirm = async () => {
    await handleSendImage();
    await handlePlayerDone();
    await socket.emit('get-player-state');
  };

  return (
    <>
      {/* Content Moderation Error Modal */}
      {showModerationError && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowModerationError(false)}
        >
          <div 
            className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Error Icon */}
            <div className="text-6xl mb-4">⚠️</div>
            
            {/* Error Message */}
            <h2 className="text-2xl font-inter font-bold text-red-600 mb-3">
              Image Generation Failed
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              Your image prompt was rejected by the content safety system. 
              Please try a different prompt.
            </p>
            
            {/* Close Instructions */}
            <p className="text-sm text-gray-500 mb-4">
              Click anywhere to dismiss
            </p>
            
            {/* Close Button */}
            <button 
              onClick={() => setShowModerationError(false)}
              className="bg-black text-white px-6 py-2 rounded-full font-gooper hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      
      {waitingForPlayers && !hasGenerated && (
        <Waiting 
          message="Waiting for other players..." 
          showGenerationProgress={true} 
        />
      )}
      {showConfirmView ? (
        // Confirmation View
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="flex flex-col items-center">
            <h2 className="text-[2rem] font-inter font-semibold">
              Confirm Your Generated Image
            </h2>
            <p className="text-lg text-gray-600">Based on the reference image</p>
          </div>

          {/* Test purpose */}
          {/* TODO: Add image that was clicked from previous view */}
          <img
            src={confirmImage}
            className="w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[32rem] aspect-square"
            alt="background"
          />
          <div className="flex justify-stretch gap-[1.25rem] mt-4">
            <button
              onClick={() => setShowConfirmView(false)}
              className="px-4 py-2 bg-gray-300 rounded-full border border-black border-[0.0625rem] font-gooper py-[0.75rem] px-[2rem] rounded-[0.64rem] text-[1.25rem]"
            >
              Back
            </button>
            <button
              // next turn
              className="px-4 py-2 bg-black rounded-full border border-black border-[0.0625rem] font-gooper py-[0.75rem] px-[2rem] rounded-[0.64rem] text-[1.25rem] text-white"
              onClick={() => {
                handleConfirm();
                setWaitingForPlayers(true);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : (
        // Default Chat View with Reference Image
        <>
          <div className="flex flex-col items-center mb-4">
            {/* <h2 className="text-[2rem] font-inter font-semibold">
              Create an image based on the reference
            </h2> */}
          </div>
          
          {/* new layout: reference image on the left + chat area on the right */}
          <div className="flex flex-col lg:flex-row h-auto lg:h-[45rem] w-full px-2 sm:px-4 lg:px-8 gap-4 lg:gap-6">
            {/* left-side reference-image area */}
            <div className="w-full lg:w-1/4 flex flex-col">
              <h3 className="text-lg font-inter font-medium mb-3 text-center">Reference Image</h3>
              <div className="flex-1 border border-gray-300 rounded-2xl p-4 bg-gray-50 flex flex-col items-center justify-center">
                {!gameStarted ? (
                  <div className="flex flex-col items-center">
                    <div className="text-6xl mb-4">⏳</div>
                    <p className="text-lg font-medium text-gray-700 text-center">
                      Waiting for all players to join...
                    </p>
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      Reference image will appear when the game starts
                    </p>
                  </div>
                ) : isLoadingReference ? (
                  <div className="flex flex-col items-center">
                    <MetroSpinner loading={true} color="#111111" size={50} />
                    <p className="mt-2 text-gray-600">Loading reference...</p>
                  </div>
                ) : referenceImage ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={getImageUrl(referenceImage.image_path)}
                      alt={referenceImage.description}
                      className="max-w-full max-h-[14rem] lg:max-h-[20rem] rounded-xl object-contain mb-3"
                      onError={(e) => {
                        console.error('Failed to load image:', e.target.src);
                        e.target.style.display = 'none';
                      }}
                    />
                                    <div className="text-center">
                  <p className="font-medium text-gray-800">Original Image</p>
                  <p className="text-sm text-gray-600 mt-1">Reference for your creation</p>
                </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No reference image available</p>
                )}
              </div>
            </div>
            
            {/* right-side chat/generation area */}
            <div className="w-full lg:w-3/4 flex flex-col">
            {!gameStarted ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-6xl mb-4">🎮</div>
                <p className="text-xl font-medium text-gray-700 text-center mb-2">
                  Game Starting Soon...
                </p>
                <p className="text-sm text-gray-500 text-center">
                  Please wait for all players to join before starting the creative process!
                </p>
              </div>
            ) : (
              <>
                {/* image display area */}
                <div className="flex-1 flex flex-col p-4">
                  {isGenerating ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <div className="w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[30rem] aspect-square bg-[#DDDDDD] rounded-[1.3rem] flex flex-col items-center justify-center">
                        <div className="relative mb-6">
                          <FireworkSpinner size={100} thickness={15} color="black" />
                          <i className="fa-solid fa-image absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl text-gray-600" />
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <p className="text-lg text-gray-600">Generating your image...</p>
                          <p className="text-sm text-gray-500 mt-1">Please wait, this may take a few moments</p>
                        </div>
                      </div>
                    </div>
                  ) : hasGenerated ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <div className="w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[30rem] aspect-square rounded-[1.3rem] relative overflow-hidden shadow-lg">
                        <img
                          src={getImageUrl(generatedImages[0])}
                          className="w-full h-full rounded-[1.3rem] object-cover"
                          alt="Generated image"
                        />
                        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center bg-black bg-opacity-60 text-white py-2 mx-4 rounded-lg">
                          <div className="flex items-center mb-1">
                            <MetroSpinner loading={true} color="#ffffff" size={16} />
                            <p className="text-sm ml-2">Waiting for other players...</p>
                          </div>
                          <p className="text-xs text-gray-200">
                            Your image has been submitted successfully
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <div className="w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[30rem] aspect-square bg-[#DDDDDD] rounded-[1.3rem] flex flex-col items-center justify-center relative">
                        {/* Placeholder content */}
                        <div className="flex flex-col items-center text-center mt-8">
                          <i className="fa-solid fa-image text-6xl text-gray-500 mb-4"></i>
                          <p className="text-lg text-gray-600 mb-2">No image generated yet</p>
                          <p className="text-sm text-gray-500">
                            Enter an image prompt below to generate an image
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* input area */}
                <div className="border border-[#E8E8E8] bg-[#FAFAFA] pl-[1rem] border-[0.0625rem] rounded-[2rem] h-fit">
                  <form onSubmit={sendMessage} className="flex p-2">
                    <input
                      type="text"
                      className="bg-transparent w-full min-w-0 focus:outline-none"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={hasGenerated ? "Image already generated" : "Enter your image prompt"}
                      maxLength={4000}
                      disabled={hasGenerated}
                    />
                    <div className="text-sm text-gray-500 text-right content-center pr-2 whitespace-nowrap">
                      {tokenCount} tokens
                    </div>

                    <button
                      type="submit"
                      disabled={isGenerating || hasGenerated || !input.trim()}
                      className={`rounded-[4.9375rem] w-[2.5rem] h-[2.5rem] text-white transition-colors ${
                        isGenerating || hasGenerated || !input.trim()
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-black hover:bg-gray-800'
                      }`}
                    >
                      {isGenerating ? (
                        <MetroSpinner loading={true} color="#ffffff" size={20} />
                      ) : (
                        <i className="fa-solid fa-arrow-up"></i>
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
          </div>
        </>
      )}
    </>
  );
}
