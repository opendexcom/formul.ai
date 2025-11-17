import { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button, Modal } from '../ui';

interface RefreshAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: RefreshOptions) => void;
  totalResponses: number;
  analyzedResponses: number;
  pendingResponses: number;
}

export interface RefreshOptions {
  reprocessResponses: boolean;
  onlyFailed: boolean;
}

export const RefreshAnalyticsModal: React.FC<RefreshAnalyticsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  totalResponses,
  analyzedResponses,
  pendingResponses,
}) => {
  const [reprocessResponses, setReprocessResponses] = useState(false);
  const [onlyFailed, setOnlyFailed] = useState(true);

  const handleConfirm = () => {
    onConfirm({ reprocessResponses, onlyFailed });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Refresh Analytics Options">
      <div className="space-y-4">
        {/* Stats Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-900">{totalResponses}</div>
              <div className="text-xs text-blue-600">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">{analyzedResponses}</div>
              <div className="text-xs text-green-600">Analyzed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-900">{pendingResponses}</div>
              <div className="text-xs text-amber-600">Pending</div>
            </div>
          </div>
        </div>

        {/* Reprocess Options */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Refresh Options</h4>
          
          {/* Option 1: Quick refresh (no reprocessing) */}
          <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="refreshOption"
              checked={!reprocessResponses}
              onChange={() => setReprocessResponses(false)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Quick Refresh (Recommended)</div>
              <div className="text-sm text-gray-600">
                Only regenerate aggregate analytics using existing response metadata. Fast and efficient.
              </div>
            </div>
          </label>

          {/* Option 2: Full reprocess */}
          <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="refreshOption"
              checked={reprocessResponses}
              onChange={() => setReprocessResponses(true)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Full Reprocess</div>
              <div className="text-sm text-gray-600">
                Regenerate individual response metadata using AI, then aggregate. Slower but ensures fresh analysis.
              </div>
            </div>
          </label>
        </div>

        {/* Sub-option when reprocessing is selected */}
        {reprocessResponses && (
          <div className="ml-6 pl-4 border-l-2 border-blue-200 space-y-2">
            <h5 className="text-sm font-medium text-gray-700">Reprocess Scope</h5>
            
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="reprocessScope"
                checked={onlyFailed}
                onChange={() => setOnlyFailed(true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Only Failed/Pending ({pendingResponses})</div>
                <div className="text-xs text-gray-600">
                  Reprocess only responses that haven't been analyzed yet
                </div>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="reprocessScope"
                checked={!onlyFailed}
                onChange={() => setOnlyFailed(false)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">All Responses ({totalResponses})</div>
                <div className="text-xs text-gray-600">
                  Regenerate metadata for all responses (useful after prompt improvements)
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Warning for full reprocess */}
        {reprocessResponses && !onlyFailed && totalResponses > 20 && (
          <div className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Warning:</strong> Reprocessing all {totalResponses} responses will take significant time 
              and consume AI credits. Consider using "Only Failed/Pending" option unless you have a specific reason 
              to regenerate all metadata.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            icon={RefreshCw}
            onClick={handleConfirm}
          >
            {reprocessResponses 
              ? `Reprocess ${onlyFailed ? pendingResponses : totalResponses} Responses` 
              : 'Quick Refresh'
            }
          </Button>
        </div>
      </div>
    </Modal>
  );
};
