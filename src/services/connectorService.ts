import { WebSocket } from 'ws';
import { DataTypes, IFormattedData } from './formattingService';
import { dialog } from 'electron';

const INGEST_SERVER_URL = "ws://localhost:5100/ingest";

export class ConnectorService {
    private PLAYER_NAME = "";
    private TEAM_NAME = "";
    private GROUP_CODE = "";
    private enabled = false;
    private unreachable = false;
    private ws!: WebSocket;
    private win!: Electron.Main.BrowserWindow;

    private static instance: ConnectorService;

    private constructor() { }

    public static getInstance(): ConnectorService {
        if (ConnectorService.instance == null) ConnectorService.instance = new ConnectorService();
        return ConnectorService.instance;
    }

    handleAuthProcess(playerName: string, teamName: string, groupCode: string, win: Electron.Main.BrowserWindow) {
        this.PLAYER_NAME = playerName;
        this.TEAM_NAME = teamName.toUpperCase();
        this.GROUP_CODE = groupCode;
        this.win = win;

        this.ws = new WebSocket(INGEST_SERVER_URL);
        this.ws.once('open', () => {
            this.ws.send(JSON.stringify({ type: DataTypes.AUTH, playerName: this.PLAYER_NAME, teamName: this.TEAM_NAME, groupCode: this.GROUP_CODE }))
        });
        this.ws.once('message', (msg) => {
            const json = JSON.parse(msg.toString());

            if (json.type === DataTypes.AUTH) {
                if (json.value === true) {
                    console.log('Authentication successful!');
                    this.win.setTitle(`Inhouse Tracker | Connected with Group ID: ${this.GROUP_CODE}`);
                    this.enabled = true;
                    this.websocketSetup();
                } else {
                    console.log('Authentication failed!');
                    this.win.setTitle(`Inhouse Tracker | Connected failed, Group ID or team name invalid`);
                    this.enabled = false;
                    this.ws?.terminate();

                    dialog.showMessageBoxSync(win, {
                        title: "Inhouse Tracker - Error",
                        message: "Group ID or team name invalid!",
                        type: "error"
                    });
                }
            }
        });

        this.ws.on('close', () => {
            console.log('Connection to ingest server closed');
            if (this.unreachable === true) {
                this.win.setTitle(`Inhouse Tracker | Connection failed, server not reachable`);

                dialog.showMessageBoxSync(win, {
                    title: "Inhouse Tracker - Error",
                    message: "Ingest server not reachable!",
                    type: "error"
                });
            } else {
                this.win.setTitle(`Inhouse Tracker | Connection closed`);
            }
            this.enabled = false;
            this.ws?.terminate();
        });

        this.ws.on('error', (e: any) => {
            console.log('Failed connection to ingest server - is it up?');
            if (e.code === "ECONNREFUSED") {
                this.win.setTitle(`Inhouse Tracker | Connection failed, server not reachable`);
                this.unreachable = true;
            } else {
                this.win.setTitle(`Inhouse Tracker | Connection failed`);
            }
            console.log(e);
        });
    }


    private websocketSetup() {
        this.ws.on('message', (msg) => {
            const json = JSON.parse(msg.toString());
            console.log(json);
        });
    }

    sendToIngest(formatted: IFormattedData) {
        if (this.enabled) {
            const toSend = { playerName: this.PLAYER_NAME, teamName: this.TEAM_NAME, groupCode: this.GROUP_CODE, ...formatted };
            this.ws.send(JSON.stringify(toSend));
        }
    }
}