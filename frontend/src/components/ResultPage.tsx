interface ResultProps {
  result?: string
}

export const ResultPage = ({ result }: ResultProps) => {
  const finalResult = result ? result : 'No result available.'

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-4xl font-bold mb-6 text-center">Analysis Result</h1>
      <div className="w-full max-w-3xl mx-auto border rounded-lg border-gray-100 shadow-md">
        <div className="p-6 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-semibold">Your Analysis</h2>
          <p className="text-gray-500 text-sm mt-1">Here's the detailed result of your analysis</p>
        </div>
        <div className="p-6 bg-white">
          <div className="p-4 bg-gray-100 rounded-md">
            <p className="whitespace-pre-wrap">{finalResult}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
