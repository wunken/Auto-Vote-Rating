//Fix-workaround for double loading (for Rocket Loader)
if (typeof loaded2 === 'undefined') {
    // noinspection ES6ConvertVarToLetConst
    var loaded2 = true
    // noinspection ES6ConvertVarToLetConst
    var refreshAttempts = 0
    runVote()
}

async function waitForVoteForm(maxWaitTime = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now()
        let hasTriedFocus = false
        
        const checkInterval = setInterval(() => {
            const voteForm = document.querySelector('#voteform')
            const voteButton = document.querySelector('#voteform #voteButton')
            const nicknameField = document.querySelector('#voteform #ignnn')
            
            if (voteForm && voteButton && nicknameField) {
                clearInterval(checkInterval)
                resolve(true)
            } else {
                // If form hasn't loaded after 3 seconds and we haven't tried focusing yet
                const elapsed = Date.now() - startTime
                if (elapsed > 3000 && !hasTriedFocus) {
                    hasTriedFocus = true
                    console.log('Vote form not found after 3 seconds, attempting to focus tab...')
                    
                    // Try to focus the window/tab
                    if (document.hidden) {
                        console.log('Tab is in background, this might prevent form loading')
                    }
                    
                    try {
                        window.focus()
                        // Trigger visibility change events that might help load the form
                        document.dispatchEvent(new Event('visibilitychange'))
                        document.dispatchEvent(new Event('focus'))
                    } catch (e) {
                        console.warn('Could not focus tab:', e)
                    }
                }
                
                if (elapsed > maxWaitTime) {
                    clearInterval(checkInterval)
                    resolve(false)
                }
            }
        }, 500)
    })
}

async function vote(first) {
    // Wait for vote form to load, if it doesn't load in 10 seconds, try refreshing
    const voteFormLoaded = await waitForVoteForm(10000)
    
    if (!voteFormLoaded) {
        console.warn('Vote form did not load within 10 seconds')
        
        // Only attempt refresh if we haven't tried too many times
        if (typeof refreshAttempts === 'undefined') refreshAttempts = 0
        
        if (refreshAttempts < 3) {
            refreshAttempts++
            console.log(`Attempting page refresh (attempt ${refreshAttempts}/3)`)
            location.reload()
            return
        } else {
            throwError(new Error('Vote form failed to load after 3 refresh attempts. The website may be experiencing issues.'))
            return
        }
    }

    const voteButtonCheck = document.querySelector('#voteform #voteButton')
    if (voteButtonCheck && voteButtonCheck.disabled) {
        await new Promise(resolve => {
            const timer = setInterval(()=>{
                try {
                    const button = document.querySelector('#voteform #voteButton')
                    if (button && !button.disabled) {
                        clearInterval(timer)
                        resolve()
                    }
                } catch (e) {
                    clearInterval(timer)
                    throwError(e)
                }
            }, 1000)
        })
    }

    if (first === false) return

    const project = await getProject()
    const nicknameField = document.querySelector('#voteform #ignnn')
    if (nicknameField != null) {
        nicknameField.value = project.nick
    } else {
        console.warn('Could not find nickname field (#voteform #ignnn), possibly the site structure has changed')
        // Try alternative selectors that might work
        const altField = document.querySelector('input[name="ignnn"]') || document.querySelector('input[name="nick"]') || document.querySelector('input[name="username"]')
        if (altField != null) {
            altField.value = project.nick
            console.log('Found alternative nickname field:', altField)
        } else {
            throwError(new Error('Error! It seems that some necessary element (nickname input field) is missing. The website structure may have changed.'))
            return
        }
    }
    
    const voteButton = document.querySelector('#voteform #voteButton')
    if (voteButton != null) {
        voteButton.click()
    } else {
        throwError(new Error('Error! It seems that some necessary element (vote button) is missing. The website structure may have changed.'))
        return
    }
}

function runVote() {
    const timer2 = setInterval(()=>{
        try {
            if (document.querySelector('#voteerror > font') != null) {
                const request = {}
                request.message = document.querySelector('#voteerror > font').textContent.trim()
                if (request.message.includes('Vote Registered') || request.message.includes('Vote saved. But could not connect to Votifier')) {
                    if (request.message.includes('Vote saved. But could not connect to Votifier')) {
                        chrome.runtime.sendMessage({successfully: request.message})
                    } else {
                        chrome.runtime.sendMessage({successfully: true})
                    }
                } else if (request.message.includes('already voted')) {
                    chrome.runtime.sendMessage({later: true})
                } else if (request.message.includes('Please Wait')) {
                    return
                } else {
                    if (request.message.toLowerCase().includes('not a valid playername') || request.message.includes('verification expired due to timeout') || request.message.includes('Playername can not be empty') || request.message.includes('Your name is to short') || request.message.includes('cannot verify your vote due to a low browser score') || request.message.includes('with the Anti Spam check')) {
                        request.ignoreReport = true
                    }
                    chrome.runtime.sendMessage(request)
                }
                clearInterval(timer2)
            }
        } catch (e) {
            clearInterval(timer2)
            throwError(e)
        }
    }, 1000)
}
