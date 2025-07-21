import ExamplePlugin from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class ExampleSettingTab extends PluginSettingTab {
	plugin: ExamplePlugin;

	constructor(app: App, plugin: ExamplePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Sokrates Token")
			.setDesc("Your sokrates token, exctract from request")
			.addText((text) =>
				text
					.setPlaceholder("bfd73df7-c159-4c17-92fa-a7cb585d37d5")
					.setValue(this.plugin.settings.sokratesToken)
					.onChange(async (value: string) => {
						this.plugin.settings.sokratesToken = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
