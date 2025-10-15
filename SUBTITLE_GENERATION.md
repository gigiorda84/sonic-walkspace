# 🎬 Subtitle Generation System

This application includes an advanced subtitle generation system that can automatically create SRT files from audio using speech-to-text technology.

## 🚀 Features

### Real Speech-to-Text (OpenAI Whisper)
- **High Accuracy**: Uses OpenAI's Whisper model for professional-grade transcription
- **Multi-language**: Supports Italian, English, Spanish, and more
- **Word-level Timestamps**: Precise synchronization with audio
- **Automatic Segmentation**: Intelligent breaking at natural speech pauses

### Fallback System
- **Always Works**: Graceful degradation when API is unavailable
- **Audio Analysis**: Analyzes actual audio duration for realistic timing
- **Smart Segmentation**: Creates appropriate subtitle timing based on content

## 🔧 Setup

### 1. OpenAI API Key (Optional but Recommended)

1. **Get API Key**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Create Key**: Generate a new API key for your project
3. **Add to Environment**: Add to your `.env.local` file:
   ```
   OPENAI_API_KEY=sk-proj-your-actual-key-here
   ```

### 2. Without API Key
- The system automatically falls back to intelligent mock generation
- Uses actual audio duration for timing
- Creates contextually appropriate placeholder text

## 📝 How It Works

### With OpenAI Whisper API
1. **Audio Upload**: User selects MP3, WAV, M4A, or OGG file
2. **API Call**: Audio sent to OpenAI Whisper for transcription
3. **Processing**: Word-level timestamps converted to SRT format
4. **Smart Segmentation**: Groups words into readable subtitle segments
5. **SRT Generation**: Creates properly formatted subtitle file

### Fallback Mode
1. **Audio Analysis**: Determines actual audio duration
2. **Smart Timing**: Creates segments based on duration
3. **Contextual Text**: Generates appropriate placeholder content
4. **Perfect Timing**: Ensures subtitles match audio length

## 🎯 Usage

### In the CMS
1. **Go to Subtitles Tab**: Click 🎬 Sottotitoli in the CMS
2. **Upload Audio**: Click "🎵 Nuovo da Audio"
3. **Select File**: Choose your audio file (up to 50MB)
4. **Wait for Processing**: System analyzes and transcribes
5. **Review & Edit**: Modify generated subtitles as needed

### Supported Formats
- **Audio**: MP3, WAV, M4A, OGG
- **Size Limit**: 50MB per file
- **Languages**: Auto-detected or manual specification

## 🛠️ Technical Details

### API Endpoint
- **Path**: `/api/transcribe`
- **Method**: POST
- **Input**: FormData with audio file and language
- **Output**: JSON with SRT entries and metadata

### Response Format
```json
{
  "success": true,
  "entries": [
    {
      "id": 1,
      "startTime": "00:00:00,000",
      "endTime": "00:00:03,500",
      "text": "Generated subtitle text"
    }
  ],
  "source": "openai-whisper",
  "duration": 120.5,
  "warning": "Optional warning message"
}
```

### Error Handling
- **Network Issues**: Automatic fallback to local generation
- **API Errors**: Graceful degradation with user notification
- **File Issues**: Clear error messages and suggestions

## 🔒 Privacy & Security

### Data Handling
- **Temporary Processing**: Audio only sent to API during transcription
- **No Storage**: OpenAI doesn't store audio files permanently
- **Local Fallback**: Sensitive content can use offline processing

### Best Practices
- **Test Files**: Start with non-sensitive content
- **API Limits**: Monitor OpenAI usage and costs
- **Backup Strategy**: Always review generated subtitles

## 📊 Quality Optimization

### For Best Results
- **Clear Audio**: Reduce background noise
- **Good Quality**: Use higher bitrate recordings
- **Single Speaker**: Works best with one person speaking
- **Natural Pace**: Avoid very fast or very slow speech

### Editing Tips
- **Review Timing**: Check subtitle synchronization
- **Adjust Text**: Fix any transcription errors
- **Segment Length**: Keep subtitles readable (max 2 lines)
- **Natural Breaks**: Split at sentence boundaries

## 🌍 Internationalization

### Supported Languages
- **Italian** (`it`): Primary language
- **English** (`en`): Full support
- **Spanish** (`es`): Available
- **Other**: Whisper supports 50+ languages

### Language Detection
- **Automatic**: Whisper can auto-detect language
- **Manual**: Specify language for better accuracy
- **Fallback**: Uses tour locale setting

## 🚨 Troubleshooting

### Common Issues

#### "API Error" Messages
- **Check API Key**: Ensure `OPENAI_API_KEY` is correct
- **Check Internet**: Verify network connectivity
- **Check Quota**: Ensure OpenAI account has credits

#### Poor Transcription Quality
- **Audio Quality**: Use clearer recordings
- **File Format**: Try different audio formats
- **Language Setting**: Specify correct language

#### Timing Issues
- **Manual Adjustment**: Use the edit feature
- **Regenerate**: Try processing again
- **Fallback Mode**: May have better timing for some content

### Support
- **Console Logs**: Check browser developer tools
- **API Status**: Monitor OpenAI service status
- **Fallback Available**: System always has backup option

## 🔄 Development

### Adding New Languages
1. **Update API Route**: Add language code to supported list
2. **Update Fallback**: Add sample texts for language
3. **Update UI**: Add language option in interface

### Customizing Segmentation
- **Modify Timing**: Adjust `wordsPerSegment` in API route
- **Change Breaks**: Modify punctuation detection
- **Alter Fallback**: Update segment duration calculations

---

🎉 **Enjoy creating professional subtitles automatically!** 🎉
