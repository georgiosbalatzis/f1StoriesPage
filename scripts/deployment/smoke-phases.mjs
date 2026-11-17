export function smokePhases(args) {
    const deploy = args.includes('--deploy');
    return { mode: deploy ? 'deploy' : 'full', themes: !deploy, fixtureFlows: !deploy, tyresFlows: true };
}
