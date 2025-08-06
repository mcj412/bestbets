import requests
import time
import random

def try_rss_with_different_methods():
    url = "https://www.oddsshark.com/rss.xml"

    # Method 1: Try with different User-Agents
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "curl/7.68.0",
        "Wget/1.20.3",
        "RSS-Reader/1.0",
        "FeedReader/1.0"
    ]

    for i, user_agent in enumerate(user_agents):
        print(f"\n--- Method {i+1}: Trying User-Agent: {user_agent[:50]}...")

        headers = {
            'User-Agent': user_agent,
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            print(f"Status: {response.status_code}")
            print(f"Content-Length: {len(response.content)}")
            print(f"Headers: {dict(response.headers)}")

            if response.status_code == 200 and len(response.content) > 100:
                print("SUCCESS! Got RSS content!")
                with open(f'rss_success_{i+1}.xml', 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"Saved to rss_success_{i+1}.xml")
                return response.text
            else:
                print(f"Failed: Status {response.status_code}, Length {len(response.content)}")
                if len(response.content) < 1000:
                    print(f"Content preview: {response.text[:200]}")

        except Exception as e:
            print(f"Error: {e}")

        # Wait between requests
        time.sleep(random.uniform(1, 3))

    # Method 2: Try with session and cookies
    print("\n--- Method 8: Trying with session and cookies...")
    session = requests.Session()

    # First visit the main page to get cookies
    try:
        main_response = session.get("https://www.oddsshark.com", timeout=10)
        print(f"Main page status: {main_response.status_code}")

        # Then try the RSS feed
        rss_response = session.get(url, timeout=10)
        print(f"RSS status: {rss_response.status_code}")
        print(f"RSS content length: {len(rss_response.content)}")

        if rss_response.status_code == 200 and len(rss_response.content) > 100:
            print("SUCCESS with session!")
            with open('rss_success_session.xml', 'w', encoding='utf-8') as f:
                f.write(rss_response.text)
            print("Saved to rss_success_session.xml")
            return rss_response.text

    except Exception as e:
        print(f"Session error: {e}")

    print("\nAll methods failed. The RSS feed is likely completely blocked.")
    return None

if __name__ == "__main__":
    result = try_rss_with_different_methods()
    if result:
        print(f"\nRSS Content (first 500 chars):\n{result[:500]}")
    else:
        print("\nCould not access the RSS feed. It's blocked by AWS WAF.")
