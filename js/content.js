import { round, score, getListLength, getChallengeListLength } from './score.js';

const getBasePath = () => {
    const isGitHubPages = window.location.hostname.includes('github.io');
    const repoName = 'CP9DL';
    
    if (isGitHubPages) {
        return `/${repoName}/data`;
    }
    
    return './data';
};

const dir = getBasePath();
console.log('Data directory path:', dir);

export async function fetchList() {
    const listUrl = `${dir}/list.json`;
    console.log('Fetching list from:', listUrl);
    
    try {
        const listResult = await fetch(listUrl);
        if (!listResult.ok) {
            console.error(`Failed to fetch list: ${listResult.status} ${listResult.statusText}`);
            throw new Error(`Failed to fetch list: ${listResult.statusText}`);
        }
        const list = await listResult.json();
        
        const fetchLevel = async (path) => {
            const levelUrl = `${dir}/${path}.json`;
            console.log('Fetching level from:', levelUrl);
            
            try {
                const levelResult = await fetch(levelUrl);
                if (!levelResult.ok) {
                    console.error(`Failed to fetch level: ${levelResult.status} ${levelResult.statusText}`);
                    return null; 
                }
                const level = await levelResult.json();
                
                const filteredRecords = level.records.filter(record => record.percent === 100);
                
                return {
                    ...level,
                    path,
                    records: filteredRecords,
                    percentToQualify: 100,
                    type: 'demon'
                };
            } catch (error) {
                console.error(`Error fetching level ${path}:`, error);
                return null; 
            }
        };

        const levels = await Promise.all(list.map(fetchLevel));
        return levels.filter(level => level !== null);
    } catch (error) {
        console.error('Error fetching list:', error);
        return []; 
    }
}

export async function fetchChallengeList() {
    const listUrl = `${dir}/challenge-list.json`;
    console.log('Fetching challenge list from:', listUrl);
    
    try {
        const listResult = await fetch(listUrl);
        if (!listResult.ok) {
            console.error(`Failed to fetch challenge list: ${listResult.status} ${listResult.statusText}`);
            throw new Error(`Failed to fetch challenge list: ${listResult.statusText}`);
        }
        const list = await listResult.json();
        
        const fetchLevel = async (path) => {
            const levelUrl = `${dir}/challenges/${path}.json`;
            console.log('Fetching challenge level from:', levelUrl);
            
            try {
                const levelResult = await fetch(levelUrl);
                if (!levelResult.ok) {
                    console.error(`Failed to fetch challenge: ${levelResult.status} ${levelResult.statusText}`);
                    return null; 
                }
                const level = await levelResult.json();
                
                return {
                    ...level,
                    path,
                    type: 'challenge'
                };
            } catch (error) {
                console.error(`Error fetching challenge ${path}:`, error);
                return null; 
            }
        };

        const levels = await Promise.all(list.map(fetchLevel));
        return levels.filter(level => level !== null);
    } catch (error) {
        console.error('Error fetching challenge list:', error);
        return []; 
    }
}

export async function fetchLeaderboard() {
    const [demonList, challengeList] = await Promise.all([fetchList(), fetchChallengeList()]);
    const listLength = demonList.length;
    const challengeListLength = challengeList.length;

    const scoreMap = {};
    
    // Process demon list
    demonList.forEach((level, rank) => {
        scoreMap[level.verifier] ??= {
            verified: [],
            completed: [],
        };
        const { verified } = scoreMap[level.verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, listLength, false),
            link: level.verification,
            type: 'demon'
        });

        level.records.forEach((record) => {
            if (record.percent !== 100) return;
            
            scoreMap[record.user] ??= {
                verified: [],
                completed: [],
            };
            const { completed } = scoreMap[record.user];
            
            completed.push({
                rank: rank + 1,
                level: level.name,
                score: score(rank + 1, listLength, false),
                link: record.link,
                type: 'demon'
            });
        });
    });
    
    // Process challenge list
    challengeList.forEach((challenge, rank) => {
        scoreMap[challenge.verifier] ??= {
            verified: [],
            completed: [],
        };
        const { verified } = scoreMap[challenge.verifier];
        verified.push({
            rank: rank + 1,
            level: challenge.name,
            score: score(rank + 1, challengeListLength, true),
            link: challenge.verification,
            type: 'challenge'
        });

        challenge.records?.forEach((record) => {
            if (record.percent < challenge.percentToQualify) return;
            
            scoreMap[record.user] ??= {
                verified: [],
                completed: [],
            };
            const { completed } = scoreMap[record.user];
            
            completed.push({
                rank: rank + 1,
                level: challenge.name,
                score: score(rank + 1, challengeListLength, true),
                link: record.link,
                type: 'challenge'
            });
        });
    });

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed } = scores;
        const total = [verified, completed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    // Sort by total score
    return res.sort((a, b) => b.total - a.total);
}