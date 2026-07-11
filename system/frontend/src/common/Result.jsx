import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import sio from './websocket';
import { MetroSpinner } from 'react-spinners-kit';
import Waiting from './Waiting';
import { getImageUrl } from '../config/api';

// Compact word-labeled badge used in the results table so a player's row
// (name, image, prompt, stats) fits on one line even on narrow phones.
function StatBadge({ value, label, colorClass }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[0.7rem] sm:text-xs font-bold whitespace-nowrap ${colorClass}`}
    >
      <span>{value}</span>
      <span>{label}</span>
    </span>
  );
}

StatBadge.propTypes = {
  value: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
  colorClass: PropTypes.string,
};

export default function Result() {
  const { gameCode } = useParams();
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [timeLeft, setTimeLeft] = useState(-1);
  
  // final-results state
  const [finalResults, setFinalResults] = useState([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(6); // Add state to track total rounds
  const [referenceDescription, setReferenceDescription] = useState('');
  const [referenceImage, setReferenceImage] = useState(null);
  

  // listen for timer updates
  useEffect(() => {
    const handleTimerUpdate = (data) => {
      setTimeLeft(data.time_left);
    };

    sio.on('update_timer', handleTimerUpdate);

    return () => {
      sio.off('update_timer', handleTimerUpdate);
    };
  }, []);


  // get the final results
  useEffect(() => {
    const fetchFinalResults = async () => {
      if (!sio.id || !sio.connected) {
        setTimeout(fetchFinalResults, 200);
        return;
      }
      
      try {
        setIsLoadingResults(true);
        const response = await axios.get(`/api/final-results?room_id=${gameCode}&sid=${sio.id}`);
        setFinalResults(response.data.results || []);
      } catch (error) {
        console.error('Error fetching final results:', error);
      } finally {
        setIsLoadingResults(false);
      }
    };
    
    fetchFinalResults();
  }, [gameCode]);

  // get round info
  useEffect(() => {
    const fetchRound = async () => {
      try {
        const response = await axios.get(`/api/round-info?room_id=${gameCode}`);
        setRound(response.data.round);
        // Also get total rounds if available
        if (response.data.total_rounds) {
          setTotalRounds(response.data.total_rounds);
        }
      } catch (error) {
        console.error('Error fetching round:', error);
      }
    };

    fetchRound();
  }, []);

  // get the reference image and description
  useEffect(() => {
    const fetchReferenceData = async () => {
      if (!sio.id || !sio.connected) {
        setTimeout(fetchReferenceData, 200);
        return;
      }
      
      try {
        const response = await axios.get(`/api/reference-image?room_id=${gameCode}&sid=${sio.id}`);
        setReferenceDescription(response.data.description || '');
        setReferenceImage(response.data);
      } catch (error) {
        console.error('Error fetching reference data:', error);
      }
    };

    fetchReferenceData();
  }, [gameCode]);

  // handle completion
  const handlePlayerDone = async () => {
    await sio.emit('player-done', {
      room_id: gameCode,
      sid: sio.id,
    });
    setWaitingForPlayers(true);
  };


  // check for a clear winner - only when the top score is unique
  const hasWinner = () => {
    if (finalResults.length === 0) return false;
    
    const highestScore = finalResults[0]?.score_info?.total_score;
    const playersWithHighestScore = finalResults.filter(
      result => result.score_info?.total_score === highestScore
    );
    
    return playersWithHighestScore.length === 1;
  };

  // get the current username - find the entry belonging to the current user in the results
  const getCurrentUserName = () => {
    if (finalResults.length > 0) {
      // try to find the result belonging to the current socket ID
      const currentUserResult = finalResults.find(result => result.creator_sid === sio.id);
      if (currentUserResult) {
        return currentUserResult.creator_name;
      }
      // if not found, fall back to a random player name
      const randomPlayer = finalResults[Math.floor(Math.random() * finalResults.length)];
      return randomPlayer?.creator_name || 'Player';
    }
    return 'Player';
  };

  // function to highlight matching words
  const highlightMatchingWords = (prompt, referenceDescription) => {
    if (!prompt || !referenceDescription) return prompt;
    
    // convert the reference description into a lowercase word array for matching
    const referenceWords = referenceDescription.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    // split the prompt into words, preserving the original format
    const words = prompt.split(/(\s+|[^\w\s]+)/);
    
    return words.map((word, index) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      
      // check whether it matches any word in the reference description
      const isMatch = cleanWord.length > 0 && referenceWords.includes(cleanWord);
      
      if (isMatch) {
        return (
          <span key={index} className="bg-[#D7E5FF] text-black px-1 rounded">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  // highlight words in the original description that overlap with any user prompt
  const highlightOriginalPrompt = (originalDescription) => {
    if (!originalDescription || finalResults.length === 0) return originalDescription;
    
    // collect the words from all users' prompts
    const allUserWords = new Set();
    finalResults.forEach(result => {
      if (result.prompt) {
        const userWords = result.prompt.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 0);
        userWords.forEach(word => allUserWords.add(word));
      }
    });
    
    // split the original description into words, preserving the original format
    const words = originalDescription.split(/(\s+|[^\w\s]+)/);
    
    return words.map((word, index) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      
      // check whether it matches any word in the users' prompts
      const isMatch = cleanWord.length > 0 && allUserWords.has(cleanWord);
      
      if (isMatch) {
        return (
          <span key={index} className="bg-[#D7E5FF] text-black px-1 rounded">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-black shadow-lg h-full flex flex-col">
      {waitingForPlayers && <Waiting />}
      
      {/* title area */}
      <div className="rounded-t-[1.25rem] overflow-hidden">
        <div className="bg-[#D7E5FF] p-5 text-center">
          <h2 className="text-3xl font-gooper font-bold mb-3">
            Round {round} Results
          </h2>
        </div>
        <div className="bg-gray-100 text-center">
          <p className="text-lg text-gray-800 px-0 py-4">
            {finalResults.length > 0 && hasWinner() && (
              <>
                Congrats, <span className="font-medium text-black bg-white border border-gray-300 px-3 py-1 rounded-full">{finalResults[0]?.creator_name}</span> wins this round!
              </>
            )}
            {finalResults.length > 0 && !hasWinner() && (
              <>
                 Onwards and upwards.
              </>
            )}
          </p>
        </div>
      </div>

      {/* reference-image row - now at the top for easy comparison */}
      {referenceImage && (
        <div className="px-3 sm:px-6 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 bg-gray-200 rounded-lg px-2 py-2 sm:px-4 sm:py-3">
            {/* "Original" label */}
            <span className="shrink-0 max-w-[3.5rem] sm:max-w-none truncate bg-white border border-gray-300 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-[0.7rem] sm:text-sm font-bold">
              Original
            </span>

            {/* reference image */}
            <img
              src={getImageUrl(referenceImage.image_path)}
              alt={referenceImage.description}
              className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg object-cover border border-gray-200 shrink-0"
              onError={(e) => {
                console.error('Failed to load image:', e.target.src);
                e.target.style.display = 'none';
              }}
            />

            {/* prompt */}
            <p className="flex-1 min-w-0 text-xs sm:text-sm font-medium line-clamp-2">
              {highlightOriginalPrompt(referenceImage.description)}
            </p>

            {/* token count badge */}
            <StatBadge
              value={referenceImage.description ? referenceImage.description.split(' ').length : 0}
              label="tokens"
              colorClass="bg-blue-100 text-blue-700 shrink-0"
            />
          </div>
        </div>
      )}
      
      {/* results-list area */}
      <div className="flex-1 flex flex-col">
        {isLoadingResults ? (
          <div className="flex flex-col items-center justify-center h-64">
            <MetroSpinner loading={true} color="#111111" size={50} />
            <p className="mt-4 text-gray-600 text-lg">Calculating results...</p>
          </div>
        ) : finalResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-xl text-gray-600 text-center">
              No results to display
            </p>
          </div>
        ) : (
          <div className="space-y-1 flex-1 overflow-auto px-3 sm:px-6">
            {finalResults.map((item, index) => (
              <>
                <div
                  key={item.creator_sid}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2"
                >
                  {/* player name - own line on mobile so it's never truncated/squeezed away */}
                  <span className="w-fit sm:shrink-0 sm:max-w-[7rem] sm:truncate bg-white border border-gray-300 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-[0.7rem] sm:text-sm font-bold">
                    {item.creator_name}
                  </span>

                  <div className="flex items-center gap-2 sm:gap-3 sm:flex-1 min-w-0">
                    {/* generated image */}
                    <img
                      src={getImageUrl(item.image_url)}
                      alt={`Creation by ${item.creator_name}`}
                      className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg object-cover border border-gray-200 shrink-0"
                      onError={(e) => {
                        console.error('Failed to load image:', e.target.src);
                        e.target.style.display = 'none';
                      }}
                    />

                    {/* prompt */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium line-clamp-2">
                        {highlightMatchingWords(item.prompt, referenceDescription)}
                      </p>
                      {item.score_info.penalty > 0 && (
                        <p className="text-[0.65rem] sm:text-xs text-red-500 mt-0.5">
                          -1 for longest prompt
                        </p>
                      )}
                    </div>

                    {/* stat badges: tokens used, votes earned */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                      <StatBadge
                        value={item.score_info.prompt_tokens}
                        label="tokens"
                        colorClass="bg-blue-100 text-blue-700"
                      />
                      <StatBadge
                        value={item.vote_count}
                        label="votes"
                        colorClass="bg-pink-100 text-pink-700"
                      />
                    </div>
                  </div>
                </div>
                {index < finalResults.length - 1 && (
                  <div className="h-px bg-gray-200/60" />
                )}
              </>
            ))}
          </div>
        )}
      </div>
      
      {/* bottom area: reflection question and button on the same row */}
      {finalResults.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-4 border-t-2 border-gray-200">
          <div className="flex-1 flex items-center gap-2 text-gray-800 bg-gray-100 px-4 py-2 rounded-lg">
            <span className="text-sm sm:text-base">Time to discuss!</span>
          </div>
          <button
            className="w-full sm:w-auto bg-black text-white px-6 py-2 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            onClick={handlePlayerDone}
          >
            {round >= totalRounds ? 'Finish Game' : 'Next round'}
          </button>
        </div>
      )}
      
      {/* if there are no results, show only the button */}
      {finalResults.length === 0 && (
        <div className="flex justify-center mt-6">
          <button
            className="bg-black text-white px-8 py-3 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors"
            onClick={handlePlayerDone}
          >
            {round >= totalRounds ? 'Finish Game' : 'Next round'}
          </button>
        </div>
      )}
    </div>
  );
}