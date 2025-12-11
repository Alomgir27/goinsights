def get_style_prompt(prompt: str, duration_seconds: int, num_segments: int, language: str, video_style: str) -> str:
    if video_style == "storytelling":
        return f"""Generate a STORYTELLING script for a video:

TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

STORYTELLING FORMAT:
- Single narrator telling an engaging story
- Create tension, emotion, and a satisfying conclusion
- Use vivid descriptions and narrative hooks

CONTENT RULES:
1. Start with a hook that grabs attention
2. Build the story with rising action
3. Include a climax or key revelation
4. End with a memorable conclusion or lesson

TECHNICAL RULES:
1. Each segment = one narrative beat (20-50 words)
2. Natural pauses between segments
3. Use "Narrator" as speaker name

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Narrator", "text": "Hook that grabs attention immediately...", "duration": 6}},
  {{"speaker": "Narrator", "text": "Building the story with vivid details...", "duration": 8}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "tutorial":
        return f"""Generate a TUTORIAL script for a video:

TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

TUTORIAL FORMAT:
- Clear step-by-step instructions
- Single instructor explaining how to do something
- Practical, actionable guidance

CONTENT RULES:
1. Start with what viewers will learn
2. Break down into clear, numbered steps
3. Include tips and common mistakes
4. End with summary and next steps

TECHNICAL RULES:
1. Each segment = one step or concept (20-50 words)
2. Use "Instructor" as speaker name
3. Keep language simple and direct

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Instructor", "text": "Today you'll learn exactly how to...", "duration": 6}},
  {{"speaker": "Instructor", "text": "Step one is to...", "duration": 8}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "documentary":
        return f"""Generate a DOCUMENTARY script for a video:

TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

DOCUMENTARY FORMAT:
- Authoritative, informative narration
- Facts, data, and expert insights
- Professional broadcast tone

CONTENT RULES:
1. Open with a compelling fact or question
2. Present information in logical sequence
3. Include statistics or expert viewpoints
4. Conclude with broader implications

TECHNICAL RULES:
1. Each segment = one information point (20-50 words)
2. Use "Narrator" as speaker name
3. Maintain serious, credible tone

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Narrator", "text": "A compelling opening fact about the topic...", "duration": 7}},
  {{"speaker": "Narrator", "text": "Research shows that...", "duration": 8}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "podcast":
        return f"""Generate a PODCAST CONVERSATION script for a video:

TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

PODCAST FORMAT:
- Casual, friendly conversation between 2 hosts
- Relaxed banter with genuine reactions
- Natural back-and-forth discussion

CONTENT RULES:
1. Hosts share opinions and personal takes
2. Include humor and casual asides
3. React naturally to each other's points
4. Feel like eavesdropping on friends talking

TECHNICAL RULES:
1. Each segment = one host's turn (20-50 words)
2. Use casual names like Mike and Lisa
3. Include natural reactions ("Oh wow", "Right?")

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Mike", "text": "So I was reading about this and honestly...", "duration": 6}},
  {{"speaker": "Lisa", "text": "Wait, really? That's wild because I always thought...", "duration": 7}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "product_demo":
        return f"""Generate a PRODUCT DEMO script for a promotional video:

PRODUCT/SERVICE: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

PRODUCT DEMO FORMAT:
- Single presenter showcasing product features
- Focus on benefits and unique selling points
- Clear demonstration of how it works

CONTENT RULES:
1. Hook: Start with the problem it solves
2. Features: Highlight 3-4 key features with benefits
3. Demo: Show how it works in practice
4. CTA: End with strong call to action

TECHNICAL RULES:
1. Each segment = one feature or benefit (15-40 words)
2. Use "Presenter" as speaker name
3. Keep tone enthusiastic but credible
4. Include specific numbers/results when possible

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Presenter", "text": "Tired of spending hours on X? Meet [Product]...", "duration": 5}},
  {{"speaker": "Presenter", "text": "With our patented technology, you can...", "duration": 6}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "testimonial":
        return f"""Generate a TESTIMONIAL script for a promotional video:

PRODUCT/TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

TESTIMONIAL FORMAT:
- Customer sharing their experience
- Authentic, conversational tone
- Problem → Solution → Results story

CONTENT RULES:
1. Start with their challenge before using product
2. Describe the moment of discovery
3. Share specific results and transformation
4. Recommend to others

TECHNICAL RULES:
1. Each segment = one part of their story (20-40 words)
2. Use a realistic customer name
3. Include specific details and numbers
4. Keep it genuine, avoid overly salesy tone

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Sarah", "text": "Before I found this, I was struggling with...", "duration": 6}},
  {{"speaker": "Sarah", "text": "Within just two weeks, I noticed...", "duration": 5}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "social_ad":
        return f"""Generate a SHORT SOCIAL AD script:

PRODUCT/MESSAGE: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

SOCIAL AD FORMAT:
- Ultra-punchy, attention-grabbing content
- Made for TikTok/Instagram/YouTube Shorts
- Fast-paced, high energy

CONTENT RULES:
1. HOOK in first 3 seconds - stop the scroll
2. Quick problem/solution or transformation
3. Social proof or urgency element
4. Clear CTA at the end

TECHNICAL RULES:
1. Each segment = one punchy statement (10-25 words)
2. Use "Voiceover" as speaker name
3. Short, punchy sentences
4. Include trending phrases or hooks

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Voiceover", "text": "Wait, you're still doing X the old way?", "duration": 3}},
  {{"speaker": "Voiceover", "text": "Here's what changed everything for me...", "duration": 4}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    elif video_style == "promo":
        return f"""Generate a PROMO/TRAILER script:

EVENT/LAUNCH: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

PROMO FORMAT:
- Cinematic announcement style
- Build anticipation and excitement
- Professional, impactful tone

CONTENT RULES:
1. Open with intrigue or bold statement
2. Build anticipation with teasers
3. Reveal the main announcement
4. End with date/CTA and urgency

TECHNICAL RULES:
1. Each segment = one dramatic beat (15-35 words)
2. Use "Announcer" as speaker name
3. Use powerful, evocative language
4. Create a sense of occasion

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Announcer", "text": "Something big is coming...", "duration": 4}},
  {{"speaker": "Announcer", "text": "On [date], everything changes...", "duration": 5}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ]"""

    return f"""Generate an EDUCATIONAL DIALOGUE script for a video:

TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

DIALOGUE FORMAT:
- EXACTLY 2 speakers: A learner asking questions and an expert explaining
- Learner: Curious, asks smart questions, shares confusions viewers might have
- Expert: Gives clear, practical answers with examples viewers can use immediately

CONTENT RULES:
1. Make every exchange valuable - teach something useful in each response
2. Include real examples, practical tips, and common mistakes to avoid
3. Keep it conversational but educational - viewers should learn something new
4. End with actionable takeaway or memorable tip

TECHNICAL RULES:
1. Each segment = ONE speaker's complete turn (all sentences before other responds)
2. Alternate: Learner asks -> Expert explains -> Learner follows up -> Expert answers
3. Each segment 20-50 words, 5-10 seconds
4. START directly with dialogue - no intros or greetings
5. Use simple names like Alex and Sam but my recommendation is to use names that are easy to understand and remember. I prefer different names not always Alex and Sam.

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Alex", "text": "I always get confused about when to use present tense. Can you explain it simply?", "duration": 6}},
  {{"speaker": "Sam", "text": "Sure! Present tense describes habits and facts. Like - I eat breakfast every morning. We add s for he or she.", "duration": 8}},
  {{"speaker": "Alex", "text": "Oh that makes sense! So she eats, he plays. What about questions?", "duration": 5}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ] - no markdown or text"""

