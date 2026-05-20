# Social Media Auto-Posting Setup

Wryte can automatically announce new blog posts to your social media accounts when you publish. This is powered by [Upload-Post](https://upload-post.com), a service that handles cross-posting to multiple platforms through a single API.

## Prerequisites

1. An [Upload-Post](https://upload-post.com) account (free tier available)
2. At least one social media account connected in Upload-Post
3. An Upload-Post API key

## Setup Steps

### 1. Create an Upload-Post Account

Go to [upload-post.com](https://upload-post.com) and sign up for an account.

### 2. Connect Your Social Accounts

In the Upload-Post dashboard, connect the social media platforms you want to post to. Supported platforms:

- X (Twitter)
- LinkedIn
- Bluesky
- Threads
- Facebook
- Instagram
- Reddit
- Pinterest
- YouTube
- TikTok
- Google Business

### 3. Generate an API Key

In the Upload-Post dashboard, navigate to your API settings and generate an API key.

### 4. Configure in Wryte

1. Open your project in Wryte
2. Go to **Project Settings** → **Social** tab
3. Paste your Upload-Post API key
4. Enter your Upload-Post profile username
5. Select which platforms to announce to
6. Click **Save & Connect**

### 5. Set Your Site URL

Go to **Project Settings** → **General** and make sure your **Site URL** is set (e.g., `https://myblog.com`). This is used to construct the blog post link in announcements.

### 6. Enable Auto-Posting

In the **Social** tab, toggle on **Post on publish**. When enabled, publishing a post to GitHub will automatically create a social media announcement.

## How It Works

When you publish a document, Wryte sends a text post to Upload-Post with the format:

```
New blog post: {Post Title}

{Site URL}/{Post Slug}
```

Upload-Post then distributes this announcement to all your selected platforms.

## Notes

- Social posting is fire-and-forget: if Upload-Post is temporarily unavailable, the blog post is still published to GitHub successfully. The social announcement may be missed.
- Each project has its own Upload-Post configuration, so different projects can post to different platforms.
- The free tier of Upload-Post allows 10 uploads per month.
- You can test your connection at any time using the **Test** button in the Social settings tab.
