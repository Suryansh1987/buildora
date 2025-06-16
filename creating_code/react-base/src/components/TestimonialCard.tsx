import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { Review } from '@/types';

interface TestimonialCardProps {
  testimonial: Review;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({ testimonial }) => {
  return (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < testimonial.rating
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="ml-2 text-sm text-gray-600">
            {new Date(testimonial.date).toLocaleDateString()}
          </span>
        </div>
        
        <p className="text-gray-700 mb-4 italic">
          "{testimonial.comment}"
        </p>
        
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
            {testimonial.userName.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {testimonial.userName}
            </div>
            <div className="text-sm text-gray-600">Verified Customer</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};