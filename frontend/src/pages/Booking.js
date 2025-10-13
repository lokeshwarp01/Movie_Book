import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiUser, FiCreditCard, FiCalendar, FiClock, FiMapPin, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Booking = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinShow, leaveShow, requestSeatLock, releaseSeatLock, isSeatLocked } = useSocket();
  
  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [seatLayout, setSeatLayout] = useState([]);

  useEffect(() => {
    if (showId) {
      fetchShowDetails();
      joinShow(showId);
    }

    return () => {
      if (showId) {
        leaveShow(showId);
        if (selectedSeats.length > 0) {
          releaseSeatLock(showId, selectedSeats.map(seat => seat._id));
        }
      }
    };
  }, [showId]);

  const fetchShowDetails = async () => {
    try {
      const response = await api.get(`/shows/${showId}`);
      const showData = response.data.data.show;
      setShow(showData);
      
      // Generate seat layout
      generateSeatLayout(showData.theater.capacity || 100);
    } catch (error) {
      toast.error('Failed to fetch show details');
      console.error('Error fetching show details:', error);
      navigate('/movies');
    } finally {
      setLoading(false);
    }
  };

  const generateSeatLayout = (totalSeats) => {
    const rows = 10;
    const seatsPerRow = Math.ceil(totalSeats / rows);
    const layout = [];

    for (let row = 0; row < rows; row++) {
      const rowLabel = String.fromCharCode(65 + row); // A, B, C, etc.
      const rowSeats = [];

      for (let seat = 1; seat <= seatsPerRow; seat++) {
        const seatId = `${rowLabel}${seat}`;
        rowSeats.push({
          _id: seatId,
          row: rowLabel,
          number: seat,
          seatNumber: seatId,
          isBooked: Math.random() < 0.1, // 10% chance of being booked
          price: getPriceForRow(row)
        });
      }
      layout.push(rowSeats);
    }
    setSeatLayout(layout);
  };

  const getPriceForRow = (rowIndex) => {
    if (rowIndex < 3) return 200; // Premium
    if (rowIndex < 7) return 150; // Gold
    return 100; // Silver
  };

  const handleSeatClick = (seat) => {
    if (seat.isBooked || isSeatLocked(showId, seat._id)) {
      return;
    }

    const isSelected = selectedSeats.find(s => s._id === seat._id);
    
    if (isSelected) {
      // Deselect seat
      const newSelection = selectedSeats.filter(s => s._id !== seat._id);
      setSelectedSeats(newSelection);
      releaseSeatLock(showId, [seat._id]);
    } else {
      // Select seat (max 10 seats)
      if (selectedSeats.length >= 10) {
        toast.error('You can select maximum 10 seats');
        return;
      }
      const newSelection = [...selectedSeats, seat];
      setSelectedSeats(newSelection);
      requestSeatLock(showId, [seat._id]);
    }
  };

  const calculateTotal = () => {
    return selectedSeats.reduce((total, seat) => total + seat.price, 0);
  };

  const handleBooking = async () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }

    setBooking(true);
    try {
      const bookingData = {
        showId,
        seats: selectedSeats.map(seat => seat._id),
        totalAmount: calculateTotal(),
        userId: user.id
      };

      const response = await api.post('/bookings', bookingData);
      
      if (response.data.success) {
        toast.success('Booking confirmed successfully!');
        navigate('/bookings');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Booking failed');
      console.error('Booking error:', error);
    } finally {
      setBooking(false);
    }
  };

  const getSeatClass = (seat) => {
    const isSelected = selectedSeats.find(s => s._id === seat._id);
    const isLocked = isSeatLocked(showId, seat._id);
    
    if (seat.isBooked) return 'bg-red-500 cursor-not-allowed';
    if (isSelected) return 'bg-green-500 text-white';
    if (isLocked) return 'bg-yellow-500 cursor-not-allowed';
    return 'bg-gray-200 hover:bg-gray-300 cursor-pointer';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Show not found</h3>
            <button
              onClick={() => navigate('/movies')}
              className="text-primary-600 hover:text-primary-700"
            >
              Back to Movies
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/movies/${show.movie._id}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back to Movie Details
          </button>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{show.movie.title}</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <FiMapPin className="w-4 h-4" />
                <span>
                  {show.theater.name}, {
                    typeof show.theater.location === 'string' 
                      ? show.theater.location 
                      : show.theater.address?.city || 'Location not available'
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4" />
                <span>{new Date(show.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <FiClock className="w-4 h-4" />
                <span>{show.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <FiUser className="w-4 h-4" />
                <span>Screen {show.screen}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Seat Selection */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Select Seats</h2>
              
              {/* Screen */}
              <div className="mb-8">
                <div className="w-full h-1 bg-gray-300 rounded mb-2"></div>
                <p className="text-center text-sm text-gray-600">SCREEN</p>
              </div>

              {/* Seat Layout */}
              <div className="space-y-2 mb-6">
                {seatLayout.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-center gap-1">
                    <span className="w-6 text-center text-sm font-medium text-gray-600">
                      {row[0]?.row}
                    </span>
                    {row.map((seat) => (
                      <button
                        key={seat._id}
                        onClick={() => handleSeatClick(seat)}
                        className={`w-6 h-6 text-xs rounded ${getSeatClass(seat)} transition-colors`}
                        disabled={seat.isBooked || isSeatLocked(showId, seat._id)}
                        title={`${seat.seatNumber} - ₹${seat.price}`}
                      >
                        {seat.number}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Locked</span>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
              
              {selectedSeats.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Selected Seats</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedSeats.map(seat => (
                        <span key={seat._id} className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded">
                          {seat.seatNumber}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Seats ({selectedSeats.length})</span>
                        <span>₹{calculateTotal()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Convenience Fee</span>
                        <span>₹{Math.round(calculateTotal() * 0.02)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-base border-t pt-2">
                        <span>Total Amount</span>
                        <span>₹{calculateTotal() + Math.round(calculateTotal() * 0.02)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleBooking}
                    disabled={booking}
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {booking ? 'Processing...' : 'Proceed to Payment'}
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <FiUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>Select seats to continue</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;