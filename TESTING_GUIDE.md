# AI-TTS-MP3 User Testing Guide

This guide helps you test the AI-TTS-MP3 application end-to-end to verify all functionality works correctly.

## 🧪 Testing Overview

The application is built with zoneless Angular using pure signal-based reactivity. This guide covers testing all major features.

## 🚀 Getting Started

1. **Start the Application**
   ```bash
   cd d:\dev\github\ai-tts-mp3
   npm start
   ```
   The app will be available at `http://localhost:4200/` or `http://localhost:4201/`

2. **Open in Browser**
   - Chrome, Firefox, or Edge recommended
   - Ensure audio is enabled

## 🔑 API Key Setup

### Testing with OpenAI

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In the app, select "OpenAI" as provider
3. Paste your API key in the "API Key" field
4. Select a voice (Alloy, Echo, Fable, Onyx, Nova, or Shimmer)

### Testing with ElevenLabs

1. Get an API key from [ElevenLabs](https://elevenlabs.io/)
2. In the app, select "ElevenLabs" as provider
3. Paste your API key in the "API Key" field
4. Voice will default to "Adam"

## 📝 Test Cases

### Test 1: Basic TTS Generation

**Objective**: Verify basic text-to-speech functionality

**Steps**:
1. Enter text: "Hello, this is a test of the AI text to speech system."
2. Select OpenAI provider
3. Choose "Alloy" voice
4. Enter valid OpenAI API key
5. Click "Generate Speech"

**Expected Results**:
- Button shows "Generating..." during processing
- Audio player appears with generated speech
- Audio can be played using browser controls
- No error messages displayed

### Test 2: Voice Selection

**Objective**: Test different voice options

**Steps**:
1. Use same text from Test 1
2. Try each voice: Alloy, Echo, Fable, Onyx, Nova, Shimmer
3. Generate speech for each voice
4. Compare audio quality and characteristics

**Expected Results**:
- Each voice produces different audio characteristics
- All voices generate successfully
- Audio quality is clear and understandable

### Test 3: Provider Switching

**Objective**: Test switching between providers

**Steps**:
1. Generate speech with OpenAI
2. Switch to ElevenLabs provider
3. Use valid ElevenLabs API key
4. Generate speech with same text
5. Compare results

**Expected Results**:
- Provider switch updates available options
- Both providers generate audio successfully
- Audio files have different characteristics

### Test 4: Error Handling

**Objective**: Verify proper error handling

**Steps**:
1. Try generating without API key
2. Try with invalid API key
3. Try with very long text (>4000 characters)
4. Try with empty text

**Expected Results**:
- Clear error messages for each scenario
- Application doesn't crash
- User can recover from errors

### Test 5: Audio Controls

**Objective**: Test audio playback features

**Steps**:
1. Generate audio successfully
2. Test play/pause buttons
3. Test audio scrubbing
4. Test volume controls
5. Test download functionality

**Expected Results**:
- All audio controls work correctly
- Download saves MP3 file
- Audio playback is smooth

### Test 6: UI Responsiveness

**Objective**: Test responsive design

**Steps**:
1. Test on different screen sizes
2. Test on mobile device
3. Verify all elements are accessible
4. Check text input resizing

**Expected Results**:
- Layout adapts to screen size
- All controls remain usable
- Text is readable at all sizes

### Test 7: Signal Reactivity

**Objective**: Verify zoneless operation

**Steps**:
1. Monitor browser dev tools for zone.js
2. Check that UI updates immediately when:
   - Text is entered
   - Provider is changed
   - Voice is selected
   - API key is entered

**Expected Results**:
- No zone.js references in console
- UI updates are instantaneous
- No performance issues

## 🐛 Common Issues & Solutions

### Issue 1: "Port already in use"
**Solution**: Use `ng serve --port 4201` or stop existing server

### Issue 2: API Key Errors
**Solutions**:
- Verify API key is valid and active
- Check provider-specific quotas
- Ensure correct provider is selected

### Issue 3: Audio Playback Issues
**Solutions**:
- Check browser audio permissions
- Try different browser
- Verify network connectivity

### Issue 4: Build Errors
**Solutions**:
- Run `npm run lint:fix`
- Clear node_modules and reinstall
- Check TypeScript version compatibility

## 📊 Performance Testing

### Load Testing
1. Generate multiple TTS requests rapidly
2. Monitor memory usage
3. Check for memory leaks
4. Verify error handling under load

### Signal Performance
1. Monitor state updates in dev tools
2. Check for unnecessary re-renders
3. Verify computed signals update correctly
4. Test with large text inputs

## ✅ Test Completion Checklist

- [ ] OpenAI TTS generation works
- [ ] ElevenLabs TTS generation works
- [ ] All voices produce different audio
- [ ] Error handling works properly
- [ ] Audio controls function correctly
- [ ] Download feature works
- [ ] UI is responsive on all screen sizes
- [ ] No zone.js dependencies detected
- [ ] Signal reactivity works as expected
- [ ] Application builds successfully
- [ ] No console errors during normal operation

## 📝 Bug Report Template

When reporting issues, include:

```
**Bug Description**: Brief description of the issue

**Steps to Reproduce**:
1. Step one
2. Step two
3. Step three

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- Browser: [Chrome/Firefox/Safari version]
- OS: [Windows/Mac/Linux]
- API Provider: [OpenAI/ElevenLabs]
- Text Length: [character count]

**Console Errors**: [Any error messages]

**Additional Notes**: [Any other relevant information]
```

## 🎯 Success Criteria

The application passes testing if:

1. ✅ Both TTS providers work correctly
2. ✅ All UI interactions are responsive
3. ✅ Error handling is graceful
4. ✅ Audio playback is smooth
5. ✅ No zone.js dependencies exist
6. ✅ Signal-based reactivity works perfectly
7. ✅ Application builds and deploys successfully
8. ✅ Cross-browser compatibility is maintained
