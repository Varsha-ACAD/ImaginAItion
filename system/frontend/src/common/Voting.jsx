import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';
import sio from './websocket';
import { MetroSpinner } from 'react-spinners-kit';
import Waiting from './Waiting';
import { getImageUrl } from '../config/api';

export default function Voting() {
  const { gameCode } = useParams();
  const location = useLocation();
  const isHost = new URLSearchParams(location.search).get('host') === 'true';

  // reference-image state
  const [referenceImage, setReferenceImage] = useState(null);
  const [isLoadingReference, setIsLoadingReference] = useState(true);
  
  // voting-related state
  const [otherPlayersImages, setOtherPlayersImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  // get the reference image
  useEffect(() => {
    const fetchReferenceImage = async () => {
      if (!sio.id || !sio.connected) {
        setTimeout(fetchReferenceImage, 200);
        return;
      }
      
      try {
        setIsLoadingReference(true);
        const response = await axios.get(`/api/reference-image?room_id=${gameCode}&sid=${sio.id}`);
        setReferenceImage(response.data);
      } catch (error) {
        console.error('Error fetching reference image:', error);
      } finally {
        setIsLoadingReference(false);
      }
    };
    
    fetchReferenceImage();
  }, [gameCode]);

  // get other players' images
  useEffect(() => {
    const fetchOtherPlayersImages = async () => {
      if (!sio.id || !sio.connected) {
        setTimeout(fetchOtherPlayersImages, 200);
        return;
      }
      
      try {
        setIsLoadingImages(true);
        const response = await axios.get(`/api/voting-images?room_id=${gameCode}&sid=${sio.id}`);
        setOtherPlayersImages(response.data.images || []);
      } catch (error) {
        console.error('Error fetching other players images:', error);
      } finally {
        setIsLoadingImages(false);
      }
    };
    
    fetchOtherPlayersImages();
  }, [gameCode]);

  // handle voting
  const handleVote = async (imageData) => {
    if (hasVoted) return;
    
    try {
      setSelectedImage(imageData);
      
      await axios.post('/api/vote', {
        room_id: gameCode,
        voter_sid: sio.id,
        voted_for_sid: imageData.creator_sid,
        image_url: imageData.image_url
      });
      
      setHasVoted(true);

      // the backend auto-checks in the vote API whether all players have voted and advances the game
      
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleForceAdvance = () => {
    if (window.confirm("Skip whoever hasn't voted and move everyone on to the next step? This can't be undone.")) {
      sio.emit('force-advance', { room_id: gameCode });
    }
  };


  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <h2 className="text-[2rem] font-inter font-semibold">
          ✨ Vote on the best image
        </h2>
        <p className="text-lg text-gray-600">
          Select the image that best matches the original.
        </p>
      </div>
      
      {/* layout: reference image on the left + voting area on the right */}
      <div className="flex flex-col lg:flex-row h-auto lg:h-[45rem] w-full px-2 sm:px-4 lg:px-8 gap-4 lg:gap-6">
        {/* left-side reference-image area - consistent with the Generate component */}
        <div className="w-full lg:w-1/4 flex flex-col">
          <h3 className="text-lg font-inter font-medium mb-3 text-center">Reference Image</h3>
          <div className="flex-1 border border-gray-300 rounded-2xl p-4 bg-gray-50 flex flex-col items-center justify-center">
            {isLoadingReference ? (
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
                  <p className="text-sm text-gray-600 mt-1">Reference for voting</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No reference image available</p>
            )}
          </div>
        </div>
        
        {/* right-side voting area */}
        <div className="w-full lg:w-3/4 flex flex-col">
          {isLoadingImages ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <MetroSpinner loading={true} color="#111111" size={50} />
              <p className="mt-2 text-gray-600">Loading images...</p>
            </div>
          ) : otherPlayersImages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-6xl mb-4">🤔</div>
              <p className="text-lg text-gray-600 text-center">
                No other images available for voting
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center items-center">
                {otherPlayersImages.map((imageData, index) => (
                  <div
                    key={index}
                    className={`w-full max-w-[18rem] sm:w-72 sm:h-80 lg:w-80 lg:h-96 border-2 rounded-3xl p-4 transition-all cursor-pointer flex flex-col shadow-lg ${
                      selectedImage?.creator_sid === imageData.creator_sid
                        ? 'border-green-500 bg-green-50 shadow-green-200' 
                        : hasVoted
                        ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:shadow-blue-200'
                    }`}
                    onClick={() => !hasVoted && handleVote(imageData)}
                  >
                    <div className="flex flex-col items-center w-full h-full">
                      <img
                        src={getImageUrl(imageData.image_url)}
                        alt={`Image ${index + 1}`}
                        className="w-full flex-1 rounded-2xl object-contain"
                        onError={(e) => {
                          console.error('Failed to load image:', e.target.src);
                          e.target.style.display = 'none';
                        }}
                      />
                      <div className="mt-3 text-center">
                        <p className="font-semibold text-lg text-gray-800">
                          Image {index + 1}
                        </p>
                        {selectedImage?.creator_sid === imageData.creator_sid && (
                          <div className="mt-2 flex items-center justify-center text-green-600">
                            <i className="fa-solid fa-check mr-2"></i>
                            <span className="font-medium">Selected!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {hasVoted && (
                <div className="mt-8 p-4 bg-green-100 border border-green-300 rounded-2xl text-center max-w-md">
                  <div className="text-green-600 font-medium">
                    ✅ Vote submitted! Waiting for other players...
                  </div>
                  {isHost && (
                    <button
                      onClick={handleForceAdvance}
                      className="mt-3 px-4 py-2 bg-[#111111] text-white rounded-lg text-sm font-normal hover:bg-gray-800 transition-colors"
                    >
                      Skip &amp; continue without them
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
} 