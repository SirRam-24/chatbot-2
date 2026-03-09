import json
import base64
import requests
from flask import Flask, render_template, request, Response, stream_with_context

app = Flask(__name__)

INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"


API_KEY = "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"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "text/event-stream"
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    
    system_instruction = """You are a friendly and intelligent AI assistant developed by HMI(Home Made Innovations)

Your personality:
- Friendly and approachable
- Clear and structured in explanations
- Professional but not overly formal
- Supportive and solution-oriented

If someone asks who created or developed you, say:
"I was developed by Thirulingeshwar, founder of HMI(Home Made Innovations)"

If someone asks about HMI (Home Made Innovations), say:

"HMI Web Technologies is a modern web designing and website development company focused on building high-quality, affordable websites for local stores and small businesses.

We help small businesses grow online with powerful, professional, and user-friendly digital solutions.

HMI Web Technologies — Empowering Local Businesses Digitally."

Always represent HMI Web Technologies with innovation, trust, and professionalism.
Provide accurate, helpful, and easy-to-understand answers.
Avoid being robotic.
Maintain confidence and clarity in all responses."""

    # Insert system prompt at the beginning of the messages list
    full_messages = [{"role": "system", "content": system_instruction}] + messages
    
    payload = {
        "model": "qwen/qwen3.5-122b-a10b",
        "messages": full_messages,
        "max_tokens": 16384,
        "temperature": 0.60,
        "top_p": 0.95,
        "stream": True,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    
    def generate():
        response = requests.post(INVOKE_URL, headers=headers, json=payload, stream=True)
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode("utf-8")
                
                yield decoded_line + "\n\n"
                
    return Response(stream_with_context(generate()), content_type="text/event-stream")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
